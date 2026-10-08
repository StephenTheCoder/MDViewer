import fs from 'node:fs/promises'
// Original LocalMD icon: blue rounded square and a white L, encoded as a Windows ICO.
const size=256, maskRow=Math.ceil(size/32)*4, pixels=Buffer.alloc(size*size*4), mask=Buffer.alloc(maskRow*size), info=Buffer.alloc(40)
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=Math.max(0,10-x/4,x/4-53),dy=Math.max(0,10-y/4,y/4-53),inside=dx*dx+dy*dy<100;const i=((size-1-y)*size+x)*4;const white=(x>=80&&x<=108&&y>=64&&y<=184)||(x>=80&&x<=180&&y>=160&&y<=188);pixels[i]=white?255:229;pixels[i+1]=white?255:118;pixels[i+2]=white?255:51;pixels[i+3]=inside?255:0;if(!inside)mask[(size-1-y)*maskRow+(x>>3)]|=1<<(7-(x&7));}
info.writeUInt32LE(40,0);info.writeInt32LE(size,4);info.writeInt32LE(size*2,8);info.writeUInt16LE(1,12);info.writeUInt16LE(32,14);info.writeUInt32LE(pixels.length+mask.length,20)
const bitmap=Buffer.concat([info,pixels,mask]),head=Buffer.alloc(22);head.writeUInt16LE(1,2);head.writeUInt16LE(1,4);head[6]=size;head[7]=size;head.writeUInt16LE(1,10);head.writeUInt16LE(32,12);head.writeUInt32LE(bitmap.length,14);head.writeUInt32LE(22,18);await fs.mkdir('build',{recursive:true});await fs.writeFile('build/icon.ico',Buffer.concat([head,bitmap]))

