/* Browser environment: canvases, viewport, device traits, camera/view state */
const $=id=>document.getElementById(id);
const cv=$('game'),ctx=cv.getContext('2d');
let DPR=1,VW=1,VH=1,S=1;
function resize(){DPR=Math.min(window.devicePixelRatio||1,2);VW=innerWidth;VH=innerHeight;cv.width=Math.round(VW*DPR);cv.height=Math.round(VH*DPR);S=Math.max(.55,Math.min(1.1,Math.min(VW,VH)/500));}
addEventListener('resize',resize);resize();
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* touch layout only when there is no mouse/trackpad at all; switches live on the first key press or touch (setInputMode) */
let isTouch=matchMedia('(pointer: coarse)').matches&&!matchMedia('(any-pointer: fine)').matches;
let running=false,cam={x:FW/2,y:FH/2},shake=0,viewF=0;
