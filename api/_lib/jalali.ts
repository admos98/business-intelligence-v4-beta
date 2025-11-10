// This is a self-contained utility for server-side functions.
// It cannot import from `../src/translations` so it has its own month names.

const jalaliMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number, jm: number, jd: number;

  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }

  return [jy, jm, jd];
}

export function toJalaliDateString(isoDate: string, options: { format?: 'numeric' | 'long' } = {}): string {
    const date = new Date(isoDate);
    // Use UTC methods to extract date components, avoiding local timezone shifts.
    const [jy, jm, jd] = gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

    if (options.format === 'long') {
        return `${jd.toLocaleString('fa-IR')} ${jalaliMonths[jm - 1]} ${jy.toLocaleString('fa-IR')}`;
    }
    
    // Default to numeric
    const fJm = String(jm).padStart(2, '0');
    const fJd = String(jd).padStart(2, '0');
    return `${jy}/${fJm}/${fJd}`;
}
