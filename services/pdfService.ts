/**
 * pdfService.ts — PDF Metin Çıkarma Motoru v4
 * 
 * Strateji:
 *  1. Tüm sayfaları parse et, her satırın font boyutu + pozisyonunu kaydet
 *  2. Header/footer → sayfalar arası tekrar analizi
 *  3. Body font boyutunu tespit et (istatistiksel)
 *  4. İlk N sayfayı (kitabın başı) → her birini kapak/ithaf/önsöz/biyografi olarak sınıflandır
 *  5. İçerik sayfalarını: asıl metin çoğunluğu olan sayfalar olarak tanımla
 *  6. Sondan → backmatter sayfalarını kes
 *  7. Sadece gerçek içerik sayfalarından temiz metin üret
 */

import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// ═══════════════════════════════════════════════════════════════
// TİPLER
// ═══════════════════════════════════════════════════════════════

interface LineData {
  y: number;
  fontSize: number;
  text: string;
}

interface PageData {
  pageNum: number;
  width: number;
  height: number;
  lines: LineData[];
}

// ═══════════════════════════════════════════════════════════════
// SABİTLER
// ═══════════════════════════════════════════════════════════════

const PAGE_NUM_RE = /^\s*[-–—]?\s*\d{1,4}\s*[-–—]?\s*$/;
const DOT_LEADER_RE = /\.{2,}\s*\d+\s*$/;
const SYMBOL_ONLY_RE = /^[\s\d.,;:!?'"()\-–—_•◦▸▪○●□■★☆©®™…\/\\|#@$%^&*+=<>{}[\]~`]+$/;

/** Yaygın ligature karakterlerini düzelt */
const LIGATURE_MAP: Record<string, string> = {
  '\uFB00': 'ff', '\uFB01': 'fi', '\uFB02': 'fl',
  '\uFB03': 'ffi', '\uFB04': 'ffl', '\uFB05': 'st', '\uFB06': 'st',
};
const LIGATURE_RE = new RegExp(Object.keys(LIGATURE_MAP).join('|'), 'g');
function fixLigatures(text: string): string {
  return text.replace(LIGATURE_RE, m => LIGATURE_MAP[m] || m);
}

/** Copyright satırı tespiti */
const COPYRIGHT_RE = /^\s*(©|copyright|all rights reserved|isbn|printed in)/i;

// Frontmatter/backmatter bölüm başlıkları — 15+ dil
const SKIP_TITLES: string[] = [
  // Türkçe
  'içindekiler', 'önsöz', 'sunuş', 'teşekkür', 'takdim', 'ithaf',
  'editörün notu', 'çevirmenin notu', 'yayıncının notu',
  'baskı bilgileri', 'künye', 'telif', 'giriş',
  'yazar hakkında', 'yazarlar hakkında', 'kaynakça', 'dizin',
  'sözlük', 'ekler', 'sonsöz', 'notlar', 'son notlar',
  'bibliyografya', 'referanslar',
  // İngilizce
  'table of contents', 'contents', 'foreword', 'preface',
  'acknowledgements', 'acknowledgments', 'dedication', 'prologue',
  'introduction', "editor's note", "translator's note", "publisher's note",
  'copyright', 'also by', 'books by',
  'about the author', 'about the authors', 'bibliography',
  'glossary', 'index', 'appendix', 'appendices', 'endnotes',
  'notes', 'references', 'afterword', 'epilogue',
  'also available', 'coming soon', 'other works',
  // Almanca
  'inhaltsverzeichnis', 'inhalt', 'vorwort', 'einleitung',
  'danksagung', 'widmung', 'über den autor', 'über die autorin',
  'literaturverzeichnis', 'glossar', 'anhang', 'register', 'nachwort',
  // Fransızca
  'table des matières', 'sommaire', 'préface', 'avant-propos',
  'remerciements', 'dédicace', "note de l'éditeur",
  "à propos de l'auteur", 'bibliographie', 'glossaire',
  'annexe', 'postface', 'épilogue',
  // İspanyolca
  'índice', 'tabla de contenidos', 'prólogo', 'prefacio',
  'agradecimientos', 'dedicatoria', 'sobre el autor', 'sobre la autora',
  'bibliografía', 'glosario', 'apéndice', 'epílogo',
  // İtalyanca
  'indice', 'prefazione', 'premessa', 'ringraziamenti', 'dedica',
  "sull'autore", 'bibliografia', 'glossario', 'appendice',
  // Portekizce
  'sumário', 'prefácio', 'agradecimentos', 'dedicatória',
  // Rusça
  'содержание', 'оглавление', 'предисловие', 'введение',
  'благодарности', 'посвящение', 'об авторе', 'библиография',
  'глоссарий', 'приложение', 'послесловие', 'эпилог',
  // Arapça
  'فهرس', 'المحتويات', 'مقدمة', 'تمهيد', 'إهداء',
  // Japonca
  '目次', 'はじめに', '序文', '謝辞',
  // Çince
  '目录', '前言', '序言', '致谢',
  // Korece
  '목차', '서문', '머리말',
  // Lehçe
  'spis treści', 'przedmowa', 'wstęp', 'podziękowania',
  // Felemenkçe
  'inhoudsopgave', 'voorwoord', 'inleiding', 'dankwoord',
  // Farsça
  'فهرست', 'مقدمه', 'پیشگفتار',
];
const SKIP_SET = new Set(SKIP_TITLES.map(k => k.toLowerCase().trim()));

// ═══════════════════════════════════════════════════════════════
// SAYFA PARSE
// ═══════════════════════════════════════════════════════════════

async function parsePage(pdf: pdfjsLib.PDFDocumentProxy, pageNum: number): Promise<PageData> {
  const page = await pdf.getPage(pageNum);
  const vp = page.getViewport({ scale: 1.0 });
  const tc = await page.getTextContent();

  const items: { str: string; x: number; y: number; fontSize: number; width: number }[] = [];
  for (const item of tc.items) {
    if (!('str' in item)) continue;
    const ti = item as TextItem;
    if (!ti.str || !ti.str.trim()) continue;
    const fontSize = Math.abs(ti.transform[3]) || Math.abs(ti.transform[0]) || 12;
    // Ligature düzeltme
    const str = fixLigatures(ti.str);
    items.push({ str, x: ti.transform[4], y: ti.transform[5], fontSize, width: ti.width });
  }

  // Multi-column desteği: önce Y'ye göre grupla, sonra X'e göre sırala
  const Y_TOLERANCE = 3;
  const lineMap = new Map<number, typeof items>();
  for (const item of items) {
    // Mevcut gruplara yakın Y var mı kontrol et
    let matched = false;
    for (const [key] of lineMap) {
      if (Math.abs(item.y - key) <= Y_TOLERANCE) {
        lineMap.get(key)!.push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      lineMap.set(item.y, [item]);
    }
  }

  const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
  const lines: LineData[] = sortedYs.map(y => {
    const li = lineMap.get(y)!.sort((a, b) => a.x - b.x);
    // Kelimeler arası akıllı boşluk: X mesafesine göre
    let text = '';
    for (let j = 0; j < li.length; j++) {
      if (j > 0) {
        const gap = li[j].x - (li[j - 1].x + li[j - 1].width);
        // Eğer öğeler arası mesafe font boyutunun %25'inden büyükse boşluk ekle
        if (gap > li[j].fontSize * 0.25) {
          text += ' ';
        }
      }
      text += li[j].str;
    }
    return {
      y,
      text,
      fontSize: li.reduce((s, i) => s + i.fontSize, 0) / li.length,
    };
  });

  return { pageNum, width: vp.width, height: vp.height, lines };
}

// ═══════════════════════════════════════════════════════════════
// ANALİZ FONKSİYONLARI
// ═══════════════════════════════════════════════════════════════

/** Body font boyutunu tespit et — en çok karakter içeren font */
function detectBodyFontSize(pages: PageData[]): number {
  const map = new Map<number, number>();
  for (const pg of pages) {
    for (const ln of pg.lines) {
      const t = ln.text.trim();
      if (t.length < 20) continue;
      const key = Math.round(ln.fontSize * 2) / 2;
      map.set(key, (map.get(key) || 0) + t.length);
    }
  }
  let best = 12, bestCount = 0;
  for (const [size, count] of map) {
    if (count > bestCount) { bestCount = count; best = size; }
  }
  return best;
}

/** Cross-page tekrarlayan header/footer satırlarını tespit et */
function detectRepeatingLines(pages: PageData[]): Set<string> {
  if (pages.length < 4) return new Set();
  const MARGIN = 0.10;
  const cands = new Map<string, number>();
  for (const pg of pages) {
    const top = pg.height * (1 - MARGIN);
    const bot = pg.height * MARGIN;
    for (const ln of pg.lines) {
      if (ln.y >= top || ln.y <= bot) {
        const key = ln.text.trim().replace(/\d+/g, '#');
        if (key.length >= 1) cands.set(key, (cands.get(key) || 0) + 1);
      }
    }
  }
  const thresh = Math.max(3, pages.length * 0.3);
  const result = new Set<string>();
  for (const [key, count] of cands) {
    if (count >= thresh) result.add(key);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// SAYFA SINIFLANDIRMA — ÇOK KATMANLI ANALİZ
// ═══════════════════════════════════════════════════════════════

function cleanForComparison(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-zA-ZÀ-ÿçğıöşüÇĞİÖŞÜа-яА-Яёа-яё\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\s'']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sayfanın "gerçek body text" satır sayısını hesapla.
 * Body text = body font boyutuna yakın font + yeterli uzunluk
 */
function countBodyLines(page: PageData, bodyFontSize: number): number {
  return page.lines.filter(ln => {
    const t = ln.text.trim();
    if (t.length < 30) return false;
    return Math.abs(ln.fontSize - bodyFontSize) < bodyFontSize * 0.2;
  }).length;
}

/**
 * Sayfanın toplam metin karakter sayısı (anlamlı metin)
 */
function meaningfulCharCount(page: PageData): number {
  let count = 0;
  for (const ln of page.lines) {
    const t = ln.text.trim();
    // Garbled/encoded metin kontrolü: normal alfabe dışı karakter oranı
    const normalChars = t.replace(/[^a-zA-ZÀ-ÿçğıöşüÇĞİÖŞÜа-яА-Яёа-яё\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\s.,!?;:'"()\-–—]/g, '');
    if (normalChars.length < t.length * 0.5 && t.length > 5) continue; // Garbled metin
    count += t.length;
  }
  return count;
}

/**
 * Sayfa bir kapak/başlık sayfası mı?
 * Kapak = az satır, çoğu kısa, büyük font başlık, yazar/çevirmen bilgisi
 */
function isCoverPage(page: PageData, bodyFontSize: number): boolean {
  const nonEmpty = page.lines.filter(l => l.text.trim().length > 0);
  if (nonEmpty.length === 0) return true;

  // Çoğunluğu tek karakter/sembol olan sayfa (! ! ! ! ! paternli kapak)
  const singleCharLines = nonEmpty.filter(l => l.text.trim().length <= 3).length;
  if (singleCharLines > nonEmpty.length * 0.5) return true;

  // Az body text satırı + büyük font başlık
  const bodyLines = countBodyLines(page, bodyFontSize);
  const hasLargeTitle = nonEmpty.some(l => l.fontSize > bodyFontSize * 1.15 && l.text.trim().length >= 3);
  if (bodyLines <= 2 && hasLargeTitle) return true;

  return false;
}

/**
 * Sayfa bir başlık sayfası mı? (kapak + yazar/çevirmen bilgisi + ithaf birleşik)
 * Büyük font başlık + "written by / illustrated by / translated by / by" vb. kalıplar
 */
function isTitlePage(page: PageData, bodyFontSize: number): boolean {
  const nonEmpty = page.lines.filter(l => l.text.trim().length > 0);
  if (nonEmpty.length === 0) return false;
  if (nonEmpty.length > 25) return false; // Çok uzun → başlık sayfası değil

  const hasLargeTitle = nonEmpty.some(l => l.fontSize > bodyFontSize * 1.15 && l.text.trim().length >= 3);
  if (!hasLargeTitle) return false;

  // Yazar/çevirmen bilgisi kalıpları (çok dilli)
  const authorPatterns = [
    /\b(written|illustrated|translated|edited|compiled)\s+(by|from)/i,
    /\bby\s+[A-Z]/,
    /\b(yazan|çeviren|yayınlayan|hazırlayan|derleyen|resimleyen)\b/i,
    /\b(auteur|traducteur|illustr[ée]|traduit)\b/i,
    /\b(autor|übersetzer|illustriert|übersetzt)\b/i,
    /\b(autor|traductor|ilustrado|traducido)\b/i,
  ];

  const hasAuthorInfo = nonEmpty.some(l => {
    const t = l.text.trim();
    return authorPatterns.some(p => p.test(t));
  });

  // Büyük başlık + yazar bilgisi = başlık sayfası
  if (hasAuthorInfo) return true;

  // Büyük başlık + ithaf (TO XXX) aynı sayfada
  const hasDedication = nonEmpty.some(l => {
    const t = l.text.trim();
    return /^TO\s+[A-Z]/i.test(t) || /\b(ithaf|dedicated to|pour|für|para|per)\b/i.test(t);
  });
  if (hasDedication) return true;

  return false;
}

/**
 * Sayfa garbled/encoded metin mi? (yazar biyografisi vb bazı PDF'lerde)
 */
function isGarbledPage(page: PageData): boolean {
  const totalChars = page.lines.reduce((s, l) => s + l.text.trim().length, 0);
  if (totalChars < 10) return false; // Boş sayfa → garbled değil, başka kontroller halleder
  const chars = meaningfulCharCount(page);
  return chars < totalChars * 0.4;
}

/**
 * Sayfa bir skip-section başlığı içeriyor mu? (önsöz, ithaf, yazar hakkında vb)
 */
function hasSkipSectionTitle(page: PageData): boolean {
  for (const ln of page.lines) {
    const clean = cleanForComparison(ln.text);
    if (clean.length >= 3 && clean.length <= 60 && SKIP_SET.has(clean)) return true;
  }
  return false;
}

/**
 * İçindekiler sayfası mı?
 */
function isTOCPage(page: PageData): boolean {
  const dotLeaders = page.lines.filter(l => DOT_LEADER_RE.test(l.text.trim())).length;
  if (dotLeaders >= 3) return true;

  // Çok sayıda kısa satır + sondaki sayı
  if (hasSkipSectionTitle(page)) {
    const numsAtEnd = page.lines.filter(l => {
      const t = l.text.trim();
      return t.length < 80 && /\d+\s*$/.test(t);
    }).length;
    if (numsAtEnd >= 4) return true;
  }
  return false;
}

/**
 * İthaf (dedication) sayfası mı?
 * TO XXX / Dedicated to / İthaf / Pour / Für vb. kalıpları TÜM satırlarda arar
 */
function isDedicationPage(page: PageData, bodyFontSize: number): boolean {
  const nonEmpty = page.lines.filter(l => l.text.trim().length > 0);
  if (nonEmpty.length === 0) return true;
  if (nonEmpty.length > 20) return false;

  // Tüm satırlarda ithaf kalıbı ara
  const hasDedicationPattern = nonEmpty.some(l => {
    const t = l.text.trim();
    if (/^TO\s+[A-Z]/i.test(t)) return true;
    if (/\b(dedicated\s+to|in\s+memory\s+of|for\s+my)\b/i.test(t)) return true;
    if (/\b(için|adına|anısına|ithaf|ithaf edilmiştir)\b/i.test(t)) return true;
    if (/^(für|para|per|для)\s+/i.test(t)) return true;
    return false;
  });

  if (hasDedicationPattern) return true;

  // Skip başlığı var + kısa sayfa
  if (hasSkipSectionTitle(page) && nonEmpty.length <= 15) return true;

  return false;
}

// ═══════════════════════════════════════════════════════════════
// İÇERİK ARALIĞI TESPİTİ
// ═══════════════════════════════════════════════════════════════

function findContentStart(pages: PageData[], bodyFontSize: number): number {
  const searchLimit = Math.min(pages.length, Math.ceil(pages.length * 0.4));

  for (let i = 0; i < searchLimit; i++) {
    const pg = pages[i];

    // Atlanacak sayfa türleri
    if (isCoverPage(pg, bodyFontSize)) continue;
    if (isTitlePage(pg, bodyFontSize)) continue;
    if (isGarbledPage(pg)) continue;
    if (isTOCPage(pg)) continue;
    if (isDedicationPage(pg, bodyFontSize)) continue;
    if (hasSkipSectionTitle(pg)) continue;

    // Boş veya çok kısa sayfa (sayfa numarası hariç)
    const meaningful = pg.lines.filter(l => {
      const t = l.text.trim();
      return t.length > 3 && !PAGE_NUM_RE.test(t);
    });
    if (meaningful.length < 3) continue;

    // Yeterli body text var mı?
    const bodyLines = countBodyLines(pg, bodyFontSize);
    if (bodyLines >= 5) return i;

    // Az body text ama anlamlı metin var
    if (bodyLines >= 3 && meaningfulCharCount(pg) > 300) return i;
  }

  return 0;
}

function findContentEnd(pages: PageData[], bodyFontSize: number, startIdx: number): number {
  let endIdx = pages.length - 1;

  // Sondan geriye doğru backmatter sayfalarını atla
  for (let i = pages.length - 1; i > startIdx; i--) {
    const pg = pages[i];
    const nonEmpty = pg.lines.filter(l => l.text.trim().length > 0);

    // Boş sayfa
    if (nonEmpty.length <= 2) { endIdx = i - 1; continue; }

    // Skip başlığı olan sayfa (yazar hakkında, kaynakça vb)
    if (hasSkipSectionTitle(pg)) { endIdx = i - 1; continue; }

    // Garbled metin
    if (isGarbledPage(pg)) { endIdx = i - 1; continue; }

    // Yeterli body text var → burası hâlâ içerik
    if (countBodyLines(pg, bodyFontSize) >= 3) break;

    // Az body text + kısa sayfa → muhtemelen backmatter
    if (nonEmpty.length <= 5 && countBodyLines(pg, bodyFontSize) < 2) {
      endIdx = i - 1;
      continue;
    }

    break;
  }

  return endIdx;
}

// ═══════════════════════════════════════════════════════════════
// TEMİZ METİN OLUŞTURMA
// ═══════════════════════════════════════════════════════════════

function isJunkLine(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;
  if (PAGE_NUM_RE.test(t)) return true;
  if (SYMBOL_ONLY_RE.test(t)) return true;
  if (DOT_LEADER_RE.test(t)) return true;
  return false;
}

function buildCleanText(lines: string[]): string {
  const result: string[] = [];
  let buffer = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (buffer) { result.push(buffer.trim()); buffer = ''; }
      continue;
    }
    if (isJunkLine(line)) continue;

    // Tire ile biten = kelime bölünmüş (sadece küçük harf + tire + küçük harf başlangıcı)
    if (/[a-zà-ÿçğıöşü]-$/.test(buffer) && /^[a-zà-ÿçğıöşü]/.test(line)) {
      buffer = buffer.slice(0, -1) + line;
    } else if (buffer) {
      buffer += ' ' + line;
    } else {
      buffer = line;
    }

    // Cümle sonu (nokta, soru, ünlem)
    if (/[.?!]\s*$/.test(line) || /[。？！]\s*$/.test(line)) {
      result.push(buffer.trim()); buffer = '';
    }
  }
  if (buffer) result.push(buffer.trim());

  return result
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length > 0)
    .join('\n\n');
}

// ═══════════════════════════════════════════════════════════════
// ANA FONKSİYON
// ═══════════════════════════════════════════════════════════════

export async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer, disableFontFace: true, verbosity: 0,
  }).promise;

  // Aşama 1: Tüm sayfaları parse et
  const allPages: PageData[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    allPages.push(await parsePage(pdf, i));
  }

  // Aşama 2: İstatistiksel analiz
  const bodyFontSize = detectBodyFontSize(allPages);
  const repeating = detectRepeatingLines(allPages);

  // Aşama 3: Kısa PDF koruması — 5 sayfa veya daha az ise filtreleme yapma
  const isShortPdf = allPages.length <= 5;
  let contentPages: PageData[];

  if (isShortPdf) {
    // Kısa PDF: sadece garbled sayfaları atla, geri kalan her şeyi al
    contentPages = allPages.filter(pg => !isGarbledPage(pg));
  } else {
    // Uzun PDF: tam filtreleme uygula
    const startIdx = findContentStart(allPages, bodyFontSize);
    const endIdx = findContentEnd(allPages, bodyFontSize, startIdx);
    contentPages = allPages.slice(startIdx, endIdx + 1);
  }

  // Aşama 4: Watermark tespiti — her sayfada aynı konumda tekrarlanan çapraz metin
  const watermarkTexts = new Set<string>();
  if (allPages.length >= 3) {
    const centerTexts = new Map<string, number>();
    for (const pg of allPages) {
      for (const ln of pg.lines) {
        // Sayfanın orta bölgesi (%30 tolerans)
        if (Math.abs(ln.y - pg.height / 2) < pg.height * 0.3) {
          const key = ln.text.trim().replace(/\d+/g, '#');
          if (key.length >= 3 && key.length <= 40) {
            centerTexts.set(key, (centerTexts.get(key) || 0) + 1);
          }
        }
      }
    }
    const wThresh = Math.max(3, allPages.length * 0.7);
    for (const [key, count] of centerTexts) {
      if (count >= wThresh) watermarkTexts.add(key);
    }
  }

  // Aşama 5: Dipnot font boyutu tespiti
  const footnoteThreshold = bodyFontSize * 0.75;

  // Aşama 6: Satır bazlı temizleme ve metin çıkarma
  const cleanLines: string[] = [];
  for (const pg of contentPages) {
    // İçerik aralığında bile skip sayfası olabilir
    if (isTOCPage(pg)) continue;
    if (isGarbledPage(pg)) continue;
    if (!isShortPdf && hasSkipSectionTitle(pg) && countBodyLines(pg, bodyFontSize) < 3) continue;

    for (const ln of pg.lines) {
      const text = ln.text.trim();
      if (!text) continue;

      // Header/footer: tekrar eden + üst/alt margin
      const MARGIN = 0.10;
      if (ln.y >= pg.height * (1 - MARGIN) || ln.y <= pg.height * MARGIN) {
        const key = text.replace(/\d+/g, '#');
        if (repeating.has(key)) continue;
        if (PAGE_NUM_RE.test(text)) continue;
      }

      // Sayfa numarası
      if (PAGE_NUM_RE.test(text)) continue;

      // Watermark
      if (watermarkTexts.has(text.replace(/\d+/g, '#'))) continue;

      // Copyright satırı
      if (COPYRIGHT_RE.test(text)) continue;

      // Dipnot (body fontan belirgin küçük font + sayfa altı)
      if (ln.fontSize < footnoteThreshold && ln.y < pg.height * 0.2) continue;

      cleanLines.push(text);
    }
    cleanLines.push(''); // sayfa arası boşluk
  }

  // Aşama 7: Temiz metin üret
  const finalText = buildCleanText(cleanLines);

  if (!finalText || finalText.length < 10) {
    throw new Error('PDF\'den okunabilir metin çıkarılamadı. Dosya görüntü tabanlı (taranmış) olabilir.');
  }

  return finalText;
}

/**
 * PDF'in ilk sayfasını canvas kullanarak düşük çözünürlüklü bir JPEG resme çevirir.
 */
export async function extractCoverFromPdf(arrayBuffer: ArrayBuffer): Promise<string | undefined> {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer, 
      disableFontFace: true, 
      verbosity: 0,
    }).promise;
    
    if (pdf.numPages === 0) return undefined;

    const page = await pdf.getPage(1);
    
    // Daha düşük çözünürlük için scale'i ayarlıyoruz (örneğin genişlik maks 400px olacak şekilde)
    const originalViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(1.0, 400 / originalViewport.width);
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // PDF render options
    const renderContext: any = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    // Kaliteyi %80 yaparak base64 string'e dönüştür (boyutu küçültmek için)
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('PDF kapak resmi çıkarılırken hata oluştu:', error);
    return undefined;
  }
}
