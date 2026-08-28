import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '练途 · 每天知道练什么',
  description: '器械训练优先的自适应计划：按日期安排周期训练，联动训练、饮食和体成分记录。',
  manifest:'/manifest.webmanifest',
  appleWebApp:{ capable:true,statusBarStyle:'default',title:'练途' },
  icons:{ icon:'/icon-192.png',apple:'/icon-192.png' },
  openGraph:{ title:'练途 · 每天知道练什么',description:'器械训练优先的自适应计划',type:'website',images:['/og.png'] },
  twitter:{ card:'summary_large_image',title:'练途 · 每天知道练什么',description:'器械训练优先的自适应计划',images:['/og.png'] },
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
