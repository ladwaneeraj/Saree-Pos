/**
 * Demo photography from Unsplash (Unsplash License: free to use, no permission needed).
 * Photos are loaded from Unsplash's image CDN at runtime, so seeded products need an
 * internet connection. Staff uploads are stored locally and work offline.
 * Full credits: CREDITS.md.
 */

export interface StockPhoto {
  /** Unsplash photo id (page: https://unsplash.com/photos/<id>). */
  id: string;
  /** Path on images.unsplash.com. */
  path: string;
  author: string;
}

const p = (id: string, path: string, author: string): StockPhoto => ({ id, path: `photo-${path}`, author });

export const PHOTOS = {
  bridalRed1: p("jrrwOSNg3Hs", "1769500804865-aa952b593186", "Rejaul Karim"),
  bridalRed2: p("gYCdjq-2830", "1769500804057-ca1391bf4617", "Rejaul Karim"),
  tamilBridePurple: p("wcgCFUi_Zws", "1641699862936-be9f49b1c38d", "Bella Pon Fruitsia"),
  purpleGold: p("bskf4Jh9hY0", "1614880886886-9314ce0323c5", "Sabesh Photography LTD"),
  greenJewellery: p("njVir8eVq1M", "1679006831648-7c9ea12e5807", "Sabesh Photography LTD"),
  greenGold: p("Cr4BApFna1c", "1709979140882-36bc79a0695f", "LOLA AZIZADA"),
  redGold: p("eh_f52tFs5k", "1705164454907-a04fe248f675", "Debojyoti Dutta"),
  blueGold: p("Viq924xVf8Y", "1585531977323-8d57bac2121b", "Susan Kirsch"),
  redGoldVeil: p("T6F0IrysJjg", "1726981448126-c7fc9237cdb5", "Jenish Ghaadiya"),
  heirloomSilk: p("nSBC88WAklo", "1588140686379-1b76a52103dc", "Souravi Sinha"),
  redBrown1: p("xTrp1WOq2Do", "1610030469983-98e550d6193c", "Bulbul Ahmed"),
  redBrown2: p("1n74YwCkcKU", "1610030469839-f909584b43f1", "Bulbul Ahmed"),
  red1: p("2cjX6iCSSXI", "1726600845193-fb25b7f4df52", "sagar shrestha"),
  red2: p("KFE22Lb6xHE", "1646979200020-941e1deb2670", "Anil Sharma"),
  red3: p("jxjOwLwoPLs", "1775486101694-f6e0f77bc347", "Sushanta Rokka"),
  redCopperPot: p("MBLJSiU0NLY", "1786822551316-aba00467197a", "manish_ jadhav_photography05"),
  redGreen: p("HMQpUMuZ0zs", "1610030469069-cb6620bea733", "Bulbul Ahmed"),
  redYellow: p("9rPam0CAYgM", "1609748341932-f0206c09412b", "Bulbul Ahmed"),
  redWhite1: p("rjgFxE3eARQ", "1619516388835-2b60acc4049e", "Sabesh Photography LTD"),
  redWhite2: p("dDvGi7doUpA", "1774437777875-119f3eddb725", "Tanmay Abhay Mahajan"),
  rustTwirl: p("AYlF9TvoXCc", "1771507057886-defc3e54aa8c", "Mehedi Hasan"),
  maroon1: p("XbEWASqbaVo", "1628477116196-48afe0d209e0", "PRATEEK JAISWAL"),
  maroon2: p("4ZOmUlV_ZBs", "1618489335755-e3aa2b16cd7a", "Sabesh Photography LTD"),
  blackRed1: p("zUCej_UkxvI", "1761125135242-0563bd33a212", "Sunil Chandra Sharma"),
  blackRed2: p("hoSSf5jmmhM", "1761125135351-268e72e39158", "Sunil Chandra Sharma"),
  blackRed3: p("qOBzXs1xjlo", "1761125135381-5bb22264deab", "Sunil Chandra Sharma"),
  blackRed4: p("57bq2960wg0", "1761125135252-e7eb993e0145", "Sunil Chandra Sharma"),
  pinkOrange: p("Xqa_NWl4xEY", "1617627143750-d86bc21e42bb", "Sabesh Photography LTD"),
  pinkPorch: p("nQAseP3G96Q", "1732709470611-670308da8c5e", "Ghunnghat Delhi"),
  pinkBlack1: p("jFyEr_5d_7A", "1742287724816-4a8a1cc7ad5c", "Himanshu Dewangan"),
  pinkBlack2: p("FKnT2BszwLA", "1742287721821-ddf522b3f37b", "Himanshu Dewangan"),
  whitePink: p("advTqcshefs", "1786300112903-25fa426be0d6", "manish_ jadhav_photography05"),
  orange: p("9vBvBSmQTaM", "1614940685083-c5409b57da6e", "Sanjeev Nagaraj"),
  yellow1: p("6Jyj6uE86A4", "1723922694741-d4faf396bab1", "Uttam Lakra"),
  yellow2: p("wII4SCbRKkE", "1671741730777-3cb7459a34b3", "sanjoy saha"),
  yellowWhite: p("NvbaIQCL_CQ", "1684961415565-80383f48c0c2", "Niaz Ahmed"),
  yellowBrown: p("E9YfnPg63gU", "1609748341642-ae4c6562bf3d", "Bulbul Ahmed"),
  yellowBlue: p("ryRXiFhMZ3I", "1607160913770-0d8aa84c84aa", "Ivy Aralia Nizar"),
  yellowPurple: p("BsL8D9rjnsc", "1612273882937-44c5313400e5", "Sabesh Photography LTD"),
  yellowRedWide: p("MZtI8RnGGpM", "1610189337543-1c5d8e64f574", "Bulbul Ahmed"),
  whiteRedBorder: p("j7Ljsqhnwag", "1678705730064-a7ecbab4b3fb", "Sabesh Photography LTD"),
  white: p("DPmLiPzXMRs", "1778770295986-08f214557fbe", "Mohammad Ali"),
  whiteGoldWide: p("t0uFIywV6g4", "1659293554631-d7a38642c5e3", "Adesh Bankar"),
  cream: p("Rm9DL9DmGi4", "1727430228383-aa1fb59db8bf", "shades by 43"),
  blackWhite: p("hj50WxMqPVg", "1572470176170-98fa8abcb741", "Srinivas JD"),
  blackStripes: p("swutwvoDt0w", "1652517664236-2545356fad08", "V Vensin"),
  blackGold1: p("NvKEZAcBoXU", "1770747874427-465ebda188f3", "AJOY DAS"),
  blackGold2: p("AXxNJ01_sS4", "1770747874434-cc144a039cc2", "AJOY DAS"),
  grey: p("SiQTqnp-qd8", "1610030469668-8e9f641aaf27", "Bulbul Ahmed"),
  brownFloral: p("pyAi6k9EPHw", "1610189338344-f3ce0d0f6d06", "Bulbul Ahmed"),
  teal1: p("8F57VUfOB00", "1778882482268-048b110b2d13", "Mohammad Ali"),
  teal2: p("rrT2ZcPyCSA", "1778882482057-ab3e1b9db8ff", "Mohammad Ali"),
  tealFabric: p("dQO-3ud96rQ", "1676696706907-0e04665b80bd", "Jatin Gajjar"),
  greenBlue: p("LzuokPBloGc", "1610030469245-ab65c4583802", "Bulbul Ahmed"),
  blueGreen: p("yn35dZHnoWs", "1680711553988-8fba54039509", "MD Mubinur Rahman"),
  navy: p("Lx6HMXdaiD0", "1778882482253-2a0510b06f92", "Mohammad Ali"),
  blueYellow1: p("v9nCfAKxxx4", "1610189013429-a703f4b245cf", "Bulbul Ahmed"),
  blueYellow2: p("tjRs987fPfg", "1610189012906-4c0aa9b9781e", "Bulbul Ahmed"),
  blueRed: p("8yawVKD8xf4", "1609748513078-9ff6232781c5", "Bulbul Ahmed"),
  bluePurple: p("QQbwgCFQAUA", "1776005395798-9fc7c1c50e95", "Sabesh Photography LTD"),
  blueFloral: p("AZz_MHYNzFA", "1610189025857-f42fe6e8dd91", "Bulbul Ahmed"),
  bluePink: p("PUjZpN8Pbfs", "1787020308815-cf964f915b2b", "litoon dev"),
  purpleFloral: p("X-rtukesXzY", "1610189026297-df356264479c", "Bulbul Ahmed"),
  purpleWalk: p("ilAg3BzdZ9w", "1774438462976-59324bac9b26", "Tanmay Abhay Mahajan"),
  greenEmbroidered1: p("T0i7ePSvr6g", "1769165404846-2b81840f5b71", "AJOY DAS"),
  greenEmbroidered2: p("dcaBqUmaZVQ", "1769164912985-bf66b9e777f2", "AJOY DAS"),
  greenGarden: p("kF9u6cXtVmo", "1771958062901-f9a92b4c8fd4", "Pranab Debnath"),
  greenSmile1: p("QQJQzf5uKOk", "1770838447142-fe777b6869d6", "Mehedi Hasan"),
  greenSmile2: p("B-uEabpfQLk", "1770838447118-35f55e94f002", "Mehedi Hasan"),
  greenOrange: p("vaWRPp-ieMw", "1708182564325-fb1d3a3864d3", "Vishwanath Negi"),
  greenWhite: p("A7H3qmJTNJc", "1609748340041-f5d61e061ebc", "Bulbul Ahmed"),
  rickshawPrint: p("GAg1nYNfcuM", "1694243382362-14da84ba6a2d", "Horitoki Ltd"),
  colourfulHeadpiece: p("hKyT_wrtC5U", "1768560846638-93880aee6151", "AJOY DAS"),
  colourfulJewellery: p("M7A6hujuavc", "1771654805061-0218a2a372ec", "Rejaul Karim"),
  colourful: p("dCuCMZ9XnHg", "1692992193981-d3d92fabd9cb", "Horitoki Ltd"),
  cottonTextile: p("eLOLLINm5ZA", "1616986491129-3e37cb654c82", "soumya parthasarathy"),
  greenStripeTextile: p("w8-Vl-j2-Lc", "1619239635803-d02b1ae98e38", "Deepak Rautela"),
  blueStripeTextile: p("jM7nOw748Ho", "1619239635762-8132f6dba51c", "Deepak Rautela"),
  whitePinkFloral: p("Z528f1BWM00", "1609748340878-c690e3e4706b", "Bulbul Ahmed"),
  redCar: p("ypUQtJNb224", "1754782827370-83c57ee898dd", "Sabesh Photography LTD"),
  // Storefront imagery (not products).
  bridalSilkGroup: p("qDP8TRQM_xI", "1720413390928-7077ba5def3a", "Bella Pon Fruitsia"),
  loomWeaver: p("BaoQqcXusxE", "1788015737547-c54a34cbd562", "Apekshit Srivastava"),
  goldenThreads: p("LeYd0uXln3I", "1773847099342-33b0381cbe0d", "Esha Verma"),
  fabricStack: p("Htzlqefo8Rg", "1623310658847-33f12eaab710", "Ekaterina Grosheva"),
} as const satisfies Record<string, StockPhoto>;

export type PhotoKey = keyof typeof PHOTOS;

export function unsplashUrl(photo: StockPhoto, size: { w: number; h?: number; q?: number }): string {
  const params = new URLSearchParams({ auto: "format", fit: "crop", crop: "faces,center", w: String(size.w), q: String(size.q ?? 72) });
  if (size.h) params.set("h", String(size.h));
  return `https://images.unsplash.com/${photo.path}?${params.toString()}`;
}

export function photoCredit(photo: StockPhoto): string {
  return `Photo by ${photo.author} on Unsplash`;
}
