// Render the existing vector brand mark; no new logo artwork is generated.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require('sharp');
const mark=await fs.readFile('public/hewers-mark.svg','utf8');
const svg=mark.replace('<path','<rect width="108" height="108" fill="#002448"/><path');
const assets='ios/Hewers/Assets.xcassets';
await fs.mkdir(assets+'/AppIcon.appiconset',{recursive:true});
await fs.mkdir(assets+'/LaunchMark.imageset',{recursive:true});
await fs.mkdir(assets+'/LaunchBackground.colorset',{recursive:true});
await fs.writeFile(assets+'/Contents.json',JSON.stringify({info:{author:'xcode',version:1}},null,2));
await sharp(Buffer.from(svg)).resize(1024,1024).png().toFile(assets+'/AppIcon.appiconset/AppIcon.png');
await fs.writeFile(assets+'/AppIcon.appiconset/Contents.json',JSON.stringify({images:[{filename:'AppIcon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{author:'xcode',version:1}},null,2));
await sharp(Buffer.from(mark)).resize(216,216).png().toFile(assets+'/LaunchMark.imageset/LaunchMark.png');
await fs.writeFile(assets+'/LaunchMark.imageset/Contents.json',JSON.stringify({images:[{filename:'LaunchMark.png',idiom:'universal',scale:'2x'}],info:{author:'xcode',version:1}},null,2));
await fs.writeFile(assets+'/LaunchBackground.colorset/Contents.json',JSON.stringify({colors:[{idiom:'universal',color:{'color-space':'srgb',components:{red:'0.000',green:'0.141',blue:'0.282',alpha:'1.000'}}}],info:{author:'xcode',version:1}},null,2));
for(const [name,size] of [['apple-touch-icon',180],['app-icon-192',192],['app-icon-512',512]])await sharp(Buffer.from(svg)).resize(size,size).png().toFile('public/'+name+'.png');
console.log('Rendered iOS and Home Screen icons.');
