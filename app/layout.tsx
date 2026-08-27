import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '热量镜 · 拍照估算食物热量',
  description: '本地营养数据库优先，支持拍照识别、逐项克数校正与饮食记录。',
  manifest:'/manifest.webmanifest',
  appleWebApp:{ capable:true,statusBarStyle:'default',title:'热量镜' },
  icons:{ icon:'/icon-192.png',apple:'/icon-192.png' },
  openGraph:{ title:'热量镜',description:'拍照识别 · 本地营养优先',type:'website' },
  twitter:{ card:'summary_large_image',title:'热量镜',description:'拍照识别 · 本地营养优先' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4faf7',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
