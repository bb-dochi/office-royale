/* Shared helpers + hooks the rules use to talk to whatever is hosting them.
   The browser client replaces these hooks; a server or test harness can leave them as no-ops. */
const rnd=(a,b)=>a+Math.random()*(b-a);
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];
const NOINPUT={vx:0,vy:0,run:false};
const UI={feed(){},notice(){},noticeEnd(){},branch(){},shake(){},vibrate(){},cine(){},closure(){},result(){},reset(){},snapCam(){},itemKey:'F'};
