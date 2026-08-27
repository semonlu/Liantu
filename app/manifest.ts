import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:'热量镜',
    short_name:'热量镜',
    description:'拍照识别食物，本地营养数据优先，支持逐项校正克数。',
    start_url:'/',
    display:'standalone',
    background_color:'#f4faf7',
    theme_color:'#1f654e',
    orientation:'portrait',
    icons:[
      { src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'maskable' },
      { src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable' },
    ],
  };
}
