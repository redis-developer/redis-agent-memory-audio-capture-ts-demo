export enum Band {
  BAND_160M = '160m',
  BAND_80M = '80m',
  BAND_60M = '60m',
  BAND_40M = '40m',
  BAND_30M = '30m',
  BAND_20M = '20m',
  BAND_17M = '17m',
  BAND_15M = '15m',
  BAND_12M = '12m',
  BAND_10M = '10m',
  BAND_6M = '6m',
  BAND_2M = '2m',
  BAND_WX = 'wx',
  BAND_70CM = '70cm'
}

export function bandFor(frequency: number): Band | null {
  const megahertz = frequency / 1_000_000
  if (megahertz >= 1.8 && megahertz <= 2.0) return Band.BAND_160M
  if (megahertz >= 3.5 && megahertz <= 4.0) return Band.BAND_80M
  if (megahertz >= 5.3 && megahertz <= 5.4) return Band.BAND_60M
  if (megahertz >= 7.0 && megahertz <= 7.3) return Band.BAND_40M
  if (megahertz >= 10.1 && megahertz <= 10.15) return Band.BAND_30M
  if (megahertz >= 14.0 && megahertz <= 14.35) return Band.BAND_20M
  if (megahertz >= 18.068 && megahertz <= 18.168) return Band.BAND_17M
  if (megahertz >= 21.0 && megahertz <= 21.45) return Band.BAND_15M
  if (megahertz >= 24.89 && megahertz <= 24.99) return Band.BAND_12M
  if (megahertz >= 28.0 && megahertz <= 29.7) return Band.BAND_10M
  if (megahertz >= 50 && megahertz <= 54) return Band.BAND_6M
  if (megahertz >= 144 && megahertz <= 148) return Band.BAND_2M
  if (megahertz >= 162.4 && megahertz <= 162.55) return Band.BAND_WX
  if (megahertz >= 420 && megahertz <= 450) return Band.BAND_70CM
  return null
}
