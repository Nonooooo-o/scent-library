import "./globals.css";

export const metadata = {
  title: {
    default: "私藏香水世界",
    template: "%s｜私藏香水世界",
  },
  description: "1,612 件私人香水馆藏，按品牌、年代、香调与个人评分漫游。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
