/* ================= result card: the 인사명령 memo as a 1080×1350 image to send to friends =================
   Phones open the share sheet with the image; PCs save the PNG and copy a line of text with the link. */
const RES={};
function resultCard(){
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const FONT="'Noto Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif",f=(w,s)=>`${w} ${s}px ${FONT}`;
  x.fillStyle='#2a3036';x.fillRect(0,0,W,H);
  /* the memo, slightly tilted like it was slapped on a desk */
  x.save();x.translate(W/2,H/2-10);x.rotate(-.012);
  const mw=900,mh=1130,L=-mw/2,T=-mh/2;
  x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=50;x.shadowOffsetY=20;x.fillStyle='#fbfaf6';x.fillRect(L,T,mw,mh);x.shadowColor='transparent';
  x.strokeStyle='rgba(29,35,40,.06)';x.lineWidth=2;for(let y=T+60;y<T+mh;y+=56){x.beginPath();x.moveTo(L,y);x.lineTo(L+mw,y);x.stroke();}
  const P=L+70;
  x.fillStyle='#5d666e';x.font=f(700,24);x.textBaseline='alphabetic';x.fillText('(주)오피스로얄 인사팀',P,T+90);
  x.textAlign='right';x.fillText('인사명령',L+mw-70,T+90);x.textAlign='left';
  x.fillStyle='#1d2328';x.fillRect(P,T+110,mw-140,4);
  x.font=f(900,96);x.fillText(RES.title,P,T+250);
  x.font=f(800,34);x.fillStyle='#1d2328';x.fillText(`${RES.name} 님`,P,T+315);
  /* stamp */
  x.save();x.translate(L+mw-165,T+330);x.rotate(-.2);x.strokeStyle='#cf3626';x.fillStyle='#cf3626';
  x.lineWidth=8;x.beginPath();x.arc(0,0,92,0,7);x.stroke();x.lineWidth=4;x.beginPath();x.arc(0,0,77,0,7);x.stroke();
  x.textAlign='center';x.textBaseline='middle';
  if(RES.win){x.font=f(900,58);x.fillText('승진',0,2);}else{x.font=f(900,46);x.fillText('권고',0,-26);x.fillText('사직',0,30);}
  x.restore();x.textAlign='left';x.textBaseline='alphabetic';
  /* the facts */
  const rows=[['최종 순위',RES.place],['근속 시간',RES.time],['최종 직급',RES.rank],['최고 도달',RES.floor],['제출한 업무',RES.tasks],['처리한 동료',RES.kills]];
  let y=T+430;
  for(const[k,v]of rows){x.font=f(700,34);x.fillStyle='#5d666e';x.fillText(k,P,y);x.font=f(900,44);x.fillStyle=k==='최종 순위'?'#cf3626':'#1d2328';x.fillText(v,P+250,y);
    x.strokeStyle='rgba(29,35,40,.18)';x.setLineDash([8,8]);x.lineWidth=2;x.beginPath();x.moveTo(P,y+28);x.lineTo(L+mw-70,y+28);x.stroke();x.setLineDash([]);y+=88;}
  /* the HR note, wrapped */
  x.font=f(700,32);x.fillStyle='#1d2328';y+=30;let line='';
  for(const ch of RES.note){if(x.measureText(line+ch).width>mw-140){x.fillText(line,P,y);y+=48;line=ch.trim();}else line+=ch;}
  if(line)x.fillText(line,P,y);
  x.restore();
  x.fillStyle='#fbfaf6';x.font=f(900,44);x.textAlign='center';x.fillText('오피스 로얄',W/2,H-62);
  x.fillStyle='#f3d77a';x.font=f(700,26);x.fillText('제목: 퇴사자는 말이 없다 · '+location.host,W/2,H-24);
  return c;
}
const shareURL=()=>location.origin+location.pathname;
const shareText=()=>`오피스 로얄 ${RES.place} · ${RES.rank} · ${RES.time} 근속. 너도 살아남을 수 있어? ${shareURL()}`;
async function shareResult(){
  const btn=$('shareBtn');btn.disabled=true;
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const blob=await new Promise(r=>resultCard().toBlob(r,'image/png'));
    const file=new File([blob],'office-royale.png',{type:'image/png'});
    if(isTouch&&navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:'오피스 로얄',text:shareText()});}catch(e){if(!e||e.name!=='AbortError')throw e;}
    }else{
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='office-royale.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      let copied=false;try{await navigator.clipboard.writeText(shareText());copied=true;}catch{}
      $('rNote').textContent=copied?'결과 이미지를 저장하고, 자랑할 문구를 복사했어요.':'결과 이미지를 저장했어요.';
    }
  }catch{$('rNote').textContent='공유하지 못했어요. 다시 눌러 주세요.';}
  btn.disabled=false;
}
$('shareBtn').addEventListener('click',shareResult);
