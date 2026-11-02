// Quality gates improve capture consistency; these are not liveness checks.
export function checkFaceQuality(pixels:Uint8ClampedArray,width:number,height:number){
 if(width<90||height<90)throw Error('Move closer to the camera.');
 let brightness=0,clipped=0,gradient=0,count=0;
 const gray=(i:number)=>.299*pixels[i]+.587*pixels[i+1]+.114*pixels[i+2];
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=(y*width+x)*4,v=gray(i);brightness+=v;if(v<20||v>240)clipped++;
  const lap=gray(i-4)+gray(i+4)+gray(i-width*4)+gray(i+width*4)-4*v;
  gradient+=lap*lap;count++;
 }
 if(brightness/count<55||brightness/count>210||clipped/count>.4)throw Error('Use even front lighting. Avoid shadows and bright light behind you.');
 if(gradient/count<35)throw Error('Your face looks blurry. Clean the lens, hold still, and try again.');
}
