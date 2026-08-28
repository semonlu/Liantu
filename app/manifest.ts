import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:'练途 · 自适应训练计划',
    short_name:'练途',
    description:'按实时日期安排器械训练，联动训练、饮食和体成分记录调整计划。',
    start_url:'/',
    display:'standalone',
    background_color:'#f5f7f5',
    theme_color:'#205d47',
    orientation:'portrait',
    icons:[
      { src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'maskable' },
      { src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'maskable' },
    ],
  };
}
