type WgerLicense={id:number;short_name:string;url:string};
type WgerAsset={image?:string;thumbnails?:{medium?:string};video?:string;is_main?:boolean;license?:number;license_author?:string};
type WgerExercise={license:WgerLicense;license_author?:string;images?:WgerAsset[];videos?:WgerAsset[];translations?:Array<{language:number;description_source?:string}>};

export async function GET(request:Request) {
  try {
    const id=Number(new URL(request.url).searchParams.get('id'));
    if(!Number.isInteger(id)||id<1||id>100_000)throw new Error('动作编号无效');
    const response=await fetch(`https://wger.de/api/v2/exerciseinfo/${id}/`,{headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('动作资料暂时不可用');
    const data=await response.json() as WgerExercise;
    const image=[...(data.images||[])].sort((a,b)=>Number(Boolean(b.is_main))-Number(Boolean(a.is_main)))[0];
    const video=(data.videos||[]).find((item)=>/\.(?:mp4|webm)$/i.test(item.video||''));
    const asset=image||video;
    let license=data.license;
    if(asset?.license&&asset.license!==license.id){
      const licenseResponse=await fetch(`https://wger.de/api/v2/license/${asset.license}/`,{headers:{Accept:'application/json'}});
      if(licenseResponse.ok)license=await licenseResponse.json() as WgerLicense;
    }
    const english=(data.translations||[]).find((item)=>item.language===2);
    return Response.json({
      image:image?.thumbnails?.medium||image?.image||'',video:video?.video||'',
      author:asset?.license_author||data.license_author||'wger community',
      license:license.short_name,licenseUrl:license.url,description:english?.description_source||'',
    },{headers:{'Cache-Control':'public, max-age=86400'}});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:'动作资料暂时不可用'},{status:400});
  }
}
