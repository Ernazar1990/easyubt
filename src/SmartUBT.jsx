import React, { useState, useEffect, useRef, useCallback } from "react";
import * as mammoth from "mammoth";
import { COURSE_CHAPTERS } from "./courseData.js";
import { FINAL_EXTRA } from "./courseTests.js";
import katex from "katex";
import { fixTex } from "./mathUtil.js";
import { ELEMENTS, SOL_ANIONS, SOL_ROWS, METAL_SERIES } from "./refData.js";

/* ════ RECHARTS ════ */
/* Recharts CDN жүктеу алынып тасталды — Vite React-ты window.React етіп шығармайтындықтан, бұл UMD скрипт ешқашан дұрыс жұмыс істей алмайды (Layer.tsx: forwardRef қатесі). Статистика беті график компоненттерінің жоқтығын өзі тексеріп, оларсыз көрсетеді. */

/* ════ PWA + RESPONSIVE STYLES ════ */
if(typeof document!=="undefined"){
  // Inject responsive meta + PWA styles
  const existing=document.getElementById("ubt-global-styles");
  if(!existing){
    const s=document.createElement("style");
    s.id="ubt-global-styles";
    s.textContent=`
      *,*::before,*::after{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
      html,body{margin:0;padding:0;width:100%;height:100%;overflow-x:hidden;
        -webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased;}
      body{background:#F0F2FF;overscroll-behavior-y:contain;}
      input,textarea,select,button{font-family:inherit;font-size:inherit;}
      input[type=text],input[type=email],input[type=password],input[type=search]{
        font-size:16px!important;}/* prevent iOS zoom on focus */
      :root{--nav-h:58px;--bottom-h:calc(64px + env(safe-area-inset-bottom,0px));}
      img{max-width:100%;height:auto;}
      /* Scrollbar */
      ::-webkit-scrollbar{width:4px;height:4px;}
      ::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:#C7D2FE;border-radius:4px;}
      /* Card grid responsive */
      @media(max-width:480px){
        .resp-grid-2{grid-template-columns:1fr!important;}
        .resp-grid-3{grid-template-columns:repeat(2,1fr)!important;}
      }
      /* Safe areas */
      .pb-safe{padding-bottom:env(safe-area-inset-bottom,0px);}
      /* Animations */
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
      @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.5;}}
      @keyframes slideIn{from{transform:translateX(-100%);}to{transform:translateX(0);}}
    `;
    document.head.appendChild(s);
  }
  // Set viewport meta if not set
  if(!document.querySelector("meta[name=viewport]")){
    const m=document.createElement("meta");
    m.name="viewport";
    m.content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover";
    document.head.appendChild(m);
  }
  // PWA theme color
  if(!document.querySelector("meta[name=theme-color]")){
    const t=document.createElement("meta");
    t.name="theme-color";t.content="#4F46E5";
    document.head.appendChild(t);
  }
}

/* ════ GLOBAL STYLES ════ */
const GC = {
  card:{background:"#fff",borderRadius:20,boxShadow:"0 2px 20px rgba(79,70,229,0.08)",border:"1px solid #EEF0FF"},
  btn:{padding:"10px 20px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"inherit",transition:"all 0.18s"},
  input:{width:"100%",padding:"13px 16px",borderRadius:12,border:"2px solid #E8ECFF",background:"#FAFAFE",color:"#1E1B4B",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",transition:"border-color 0.2s"},
  tag:{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 12px",borderRadius:99,fontSize:11,fontWeight:700},
  pri:{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",boxShadow:"0 4px 15px rgba(79,70,229,0.35)"},
  sec:{background:"#EEF2FF",color:"#4F46E5"},
  success:{background:"#F0FFF4",color:"#22C55E"},
  warn:{background:"#FFFBEB",color:"#F59E0B"},
  danger:{background:"#FEF2F2",color:"#EF4444"},
};


/* ════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════ */
const SUBJECTS = [
  { id:"chemistry",  name:"Химия",                  icon:"🧪",  color:"#2E7D32", bg:"#E8F5E9", tag:"Бейінді" },
];

// Mandatory subjects always required for UBT (none — single-subject app now)
const MANDATORY_SUBS = [];

// Packages: subject bundles
// ҰБТ profile subject combinations
// Each package = 3 mandatory + 2 profile subjects (real UBT combos)
const PACKAGES = [
  { id:"pkg_chem",    name:"Химия",                   price:4990,  color:"#2E7D32", icon:"🧪",
    subjects:["chemistry"],
    desc:"Химия пәні бойынша толық дайындық", popular:true },
];

const PLANS = [
  { id:"free",    name:"Тегін",    price:0,     color:"#6B7280", features:["5 тест/күн","1-сабақ ашық (демо)","AI: 10 сұрақ/күн"],      limit:5 },
  { id:"basic",   name:"Базалық",  price:2990,  color:"#6366F1", features:["Шексіз тест","Барлық видео","AI: 50 сұрақ/күн","PDF"],      limit:50, popular:false },
  { id:"premium", name:"Премиум",  price:4990,  color:"#F59E0B", features:["Барлық функция","AI шексіз","Куратор","Сертификат"],         limit:999, popular:true },
  { id:"package", name:"Пакет",    price:0,     color:"#EC4899", features:["Таңдалған пәндер","Апталық жоспар","Толық модуль"],         limit:999 },
];

const TOPICS = { chemistry: COURSE_CHAPTERS };

const QUESTIONS = {};
SUBJECTS.forEach(s=>{ if(!QUESTIONS[s.id]) QUESTIONS[s.id]=[{id:1,q:`${s.name} — 1-сұрақ`,opts:["A","B","C","D"],ans:0,exp:"A дұрыс"},{id:2,q:`${s.name} — 2-сұрақ`,opts:["A","B","C","D"],ans:1,exp:"B дұрыс"}]; });

/* ════════════════════════════════════════════════════════
   STORAGE
════════════════════════════════════════════════════════ */
const gS=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}};
const sS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};

/* ════════════════════════════════════════════════════════
   SUPABASE SYNC (users / pending activations / codes)
   NOTE: RLS on `users` table is currently fully permissive
   (public read/insert/update). Fine for getting cross-device
   sync working now, but should be tightened later — anyone
   with this anon key can read all rows incl. passwords.
════════════════════════════════════════════════════════ */
// Supabase баптауы: Vercel → Settings → Environment Variables ішінде VITE_SUPABASE_URL және VITE_SUPABASE_ANON_KEY қойылады.
// Кілт кодта сақталмайды. Қойылмаса — URL әдепкі мәнге түседі, кілт бос болады (сервермен байланыс өшірулі).
const ENV=(typeof import.meta!=="undefined"&&import.meta.env)||{};
const SUPABASE_URL=ENV.VITE_SUPABASE_URL||"https://lerecgnvxthvrmyzmkcx.supabase.co";
const SUPABASE_ANON_KEY=ENV.VITE_SUPABASE_ANON_KEY||"";
const sbHeaders=(extra={})=>({
  "apikey":SUPABASE_ANON_KEY,
  "Authorization":"Bearer "+SUPABASE_ANON_KEY,
  "Content-Type":"application/json",
  ...extra
});

// local (camelCase, rich) -> db (snake_case, core fields only)
const toDbUser=(u)=>({
  email:u.email,
  password:u.password||"",
  name:u.name||"",
  phone:u.phone||"",
  grade:String(u.grade||"11"),
  role:u.role||"student",
  plan:u.plan||"free",
  subjects:u.subjects||[],
  xp:u.xp||0,
  streak:u.streak||0,
  avatar:u.avatar||"🧑‍🎓",
  unlock_code:u.unlockCode||null,
  status:u.status||"active",
  auth_id:u.authId||null,
});

// db (snake_case) -> local (camelCase), merged on top of an existing local user if present
const fromDbUser=(row,existingLocal=null)=>({
  ...(existingLocal||{}),
  ...row,
  id:existingLocal?.id||row.id,
  unlockCode:row.unlock_code,
  authId:row.auth_id,
  createdAt:existingLocal?.createdAt||(row.created_at?new Date(row.created_at).toLocaleDateString("kk-KZ"):""),
});

// Upsert one user row into Supabase (insert or update by email). Never throws — fails silently to console so it never breaks the local-first UX.
const sbUpsertUser=async(u)=>{
  try{
    // select= міндетті: RETURNING password бағанын сұрамау үшін (ол оқуға жабық)
    const res=await fetch(SUPABASE_URL+"/rest/v1/users?on_conflict=email&select="+SAFE_USER_COLS,{
      method:"POST",
      headers:sbHeaders({"Prefer":"resolution=merge-duplicates,return=representation"}),
      body:JSON.stringify(toDbUser(u))
    });
    if(!res.ok){console.error("Supabase upsert failed:",await res.text());return null;}
    const data=await res.json();
    return Array.isArray(data)?data[0]:data;
  }catch(e){console.error("Supabase upsert error:",e);return null;}
};

const SAFE_USER_COLS="id,email,name,phone,grade,role,plan,subjects,xp,streak,avatar,unlock_code,status,progress,achievements,study_plan,created_at,auth_id";

// Fetch all users from Supabase (used to sync pending-registration codes across devices/browsers)
const sbFetchUsers=async()=>{
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/users?select="+SAFE_USER_COLS+"&order=created_at.desc",{headers:sbHeaders()});
    if(!res.ok){console.error("Supabase fetch failed:",await res.text());return [];}
    return await res.json();
  }catch(e){console.error("Supabase fetch error:",e);return [];}
};

// Fetch a single user row from Supabase by email (used to verify activation code even after a page reload / on a different device)
const sbFetchUserByEmail=async(email)=>{
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/users?email=eq."+encodeURIComponent(email)+"&select="+SAFE_USER_COLS,{headers:sbHeaders()});
    if(!res.ok){console.error("Supabase fetch-by-email failed:",await res.text());return null;}
    const rows=await res.json();
    return rows[0]||null;
  }catch(e){console.error("Supabase fetch-by-email error:",e);return null;}
};

// Legacy plaintext login — verified server-side via RPC, password never leaves the DB.
// Returns the user row (no password field) on success, null on failure.
// Соңғы кіру әрекетінің себебі: "", "invalid", "network", "http_404" т.б. — кіру бетінде нақты қате көрсету үшін.
let lastLoginDiag="";
const sbLegacyLogin=async(email,password)=>{
  lastLoginDiag="";
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/rpc/legacy_login",{
      method:"POST",headers:sbHeaders(),
      body:JSON.stringify({p_email:email,p_password:password})
    });
    if(!res.ok){lastLoginDiag="http_"+res.status;return null;}
    const rows=await res.json();
    if(!rows[0])lastLoginDiag="invalid";
    return rows[0]||null;
  }catch(e){console.error("Supabase legacy_login error:",e);lastLoginDiag="network";return null;}
};

// Legacy аккаунттың (админ және ескі оқушылар) паролін серверде ауыстыру — RPC, supabase/migration-phase-b-admin.sql іске қосылуы керек.
// Ескі пароль сервер жағында тексеріледі. true — сәтті, false — сәтсіз.
const sbChangePassword=async(email,oldPw,newPw)=>{
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/rpc/legacy_change_password",{
      method:"POST",headers:sbHeaders(),
      body:JSON.stringify({p_email:email,p_old:oldPw,p_new:newPw})
    });
    if(!res.ok)return false;
    return (await res.json())===true;
  }catch(e){console.error("Supabase change password error:",e);return false;}
};

// ── Supabase Auth (new accounts only — see migration-phase-a.sql) ──
// Sign up a new user via Supabase Auth (real hashed password, not stored in `users` table).
// Returns {ok:true,authId} on success, {ok:false,error} on failure — never throws.
const sbAuthSignUp=async(email,password)=>{
  try{
    const res=await fetch(SUPABASE_URL+"/auth/v1/signup",{
      method:"POST",
      headers:{"apikey":SUPABASE_ANON_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const data=await res.json();
    if(!res.ok)return{ok:false,error:data?.msg||data?.error_description||"signup_failed"};
    return{ok:true,authId:data?.id||data?.user?.id||null};
  }catch(e){console.error("Supabase auth signup error:",e);return{ok:false,error:"network_error"};}
};

// Sign in via Supabase Auth. Returns {ok:true,authId,accessToken} or {ok:false}.
const sbAuthSignIn=async(email,password)=>{
  try{
    const res=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{"apikey":SUPABASE_ANON_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const data=await res.json();
    if(!res.ok)return{ok:false,error:data?.msg||data?.error_description||"login_failed"};
    return{ok:true,authId:data?.user?.id||null,accessToken:data?.access_token||null};
  }catch(e){console.error("Supabase auth signin error:",e);return{ok:false,error:"network_error"};}
};

// Send a password-reset email via Supabase Auth. Works only for accounts that have an authId
// (registered after the Auth migration). Returns {ok:true} or {ok:false,error}.
const sbAuthRecover=async(email)=>{
  try{
    const res=await fetch(SUPABASE_URL+"/auth/v1/recover",{
      method:"POST",
      headers:{"apikey":SUPABASE_ANON_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({email})
    });
    if(!res.ok){const data=await res.json().catch(()=>({}));return{ok:false,error:data?.msg||"recover_failed"};}
    return{ok:true};
  }catch(e){console.error("Supabase auth recover error:",e);return{ok:false,error:"network_error"};}
};

const INIT_USERS=[
  {id:1,name:"Алмас Сейтқали",email:"student@mail.com",password:"123",role:"student",plan:"premium",profile:"custom",subjects:["chemistry"],streak:7,xp:1250,avatar:"🧑‍🎓",phone:"",grade:11,school:"№1 мектеп",city:"Алматы",createdAt:"2024-01-15",progress:{},scores:[],homework:{},notes:{},notifications:[]},
  {id:3,name:"Нұртай",email:"nur.abuuadi@gmail.com",password:"admin",role:"admin",plan:"premium",subjects:[],streak:0,xp:0,avatar:"👑",createdAt:"2024-01-01"},
  {id:4,name:"Ернazar",email:"ernazarnurtay@gmail.com",password:"admin",role:"superadmin",plan:"premium",subjects:["chemistry"],streak:0,xp:9999,avatar:"🚀",createdAt:"2024-01-01"},
];
const INIT_VARIANTS={chemistry:[{id:"chem_r1",title:"1-нұсқа",questions:[{id:"chem_r1_q1",q:"Na атомындағы электрондар саны:",opts:["11", "10", "12", "23"],ans:0,exp:"Z=11",topic:"Атом"},{id:"chem_r1_q2",q:"Ковалентті полярлы байланыс:",opts:["HCl", "Cl₂", "NaCl", "H₂"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r1_q3",q:"sp³-гибридтелу — мысал:",opts:["CH₄", "CO₂", "BF₃", "C₂H₂"],ans:0,exp:"Метан",topic:"Гибридтелу"},{id:"chem_r1_q4",q:"Бір периодта солдан оңға электртерістілік:",opts:["Артады", "Кемиді", "Өзгермейді", "Тербеледі"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r1_q5",q:"Элементтің ең жоғары тотығу дәрежесі топ нөміріне:",opts:["Тең болады", "Аз болады", "Байланысы жоқ", "Артады"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r1_q6",q:"Fe+2HCl→FeCl₂+H₂. Тотығатын:",opts:["Fe (0→+2)", "H (+1→0)", "Cl (-1→0)", "Fe (+2→+3)"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r1_q7",q:"Cu²⁺+2e⁻→Cu — бұл процесс:",opts:["Тотықсыздану", "Тотығу", "Гидролиз", "Ион алмасу"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r1_q8",q:"NaCl балқымасын электролизде катодта:",opts:["Na↓", "Cl₂↑", "H₂↑", "O₂↑"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r1_q9",q:"Ле-Шателье: қысым артса (N₂+3H₂⇌2NH₃):",opts:["Оңға (NH₃ артады)", "Солға", "Өзгеріс жоқ", "Тек T кезінде"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r1_q10",q:"Вант-Гофф ережесі: T 10°C артса жылдамдық:",opts:["2-4 есе артады", "Кемиді", "Өзгермейді", "10 есе артады"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r1_q11",q:"Бренстед-Лоури бойынша қышқыл:",opts:["Протон беруші", "OH⁻ бөлетін", "Электрон жұбы алушы", "Протон алушы"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r1_q12",q:"Na₂CO₃ ерітіндісі рН:",opts:["рН>7 (сілтілік)", "рН<7", "рН=7", "рН=0"],ans:0,exp:"Катион гидролизі",topic:"Гидролиз"},{id:"chem_r1_q13",q:"Cu + HNO₃(сұйытылған) → өнімдер:",opts:["Cu(NO₃)₂+NO+H₂O", "Cu(NO₃)₂+NO₂+H₂O", "CuO+NO", "Реакция жоқ"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r1_q14",q:"Al+NaOH+H₂O → өнімдер:",opts:["Na[Al(OH)₄]+H₂↑", "Al₂O₃+NaCl", "AlH₃+NaOH", "Al(OH)₃↓"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r1_q15",q:"Ca(OH)₂+CO₂(артық)→",opts:["Ca(HCO₃)₂", "CaCO₃↓", "CaO+H₂O", "Ca+CO₂"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r1_q16",q:"NaOH+Al+H₂O→",opts:["Na[Al(OH)₄]+H₂↑", "NaAlO₂+H₂", "Al(OH)₃+Na", "AlH₃"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r1_q17",q:"SiO₂ — ... оксиді:",opts:["Қышқылдық", "Негіздік", "Амфотерлі", "Бейтарап"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r1_q18",q:"N атомының валенттілігі HNO₃-те:",opts:["4", "3", "5", "2"],ans:0,exp:"N+5→4 байланыс",topic:"XV топ"},{id:"chem_r1_q19",q:"H₂SO₄(конц)+Cu→",opts:["CuSO₄+SO₂↑+H₂O", "CuSO₄+H₂↑", "CuS+H₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r1_q20",q:"Контактілі тәсілде SO₂→SO₃ катализаторы:",opts:["V₂O₅", "Fe₂O₃", "Pt", "MnO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r1_q21",q:"HF,HCl,HBr,HI — қышқылдық күші (су ертіндісі):",opts:["HI>HBr>HCl>HF", "HF>HCl>HBr>HI", "Тең", "HCl>HF"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r1_q22",q:"K₃[Fe(CN)₆] — кешен қосылысындағы лиганд:",opts:["CN⁻", "Fe³⁺", "K⁺", "N³⁻"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r1_q23",q:"Алкандардың жалпы формуласы:",opts:["CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙH₂ₙ₋₂", "CₙHₙ"],ans:0,exp:"",topic:"Алкандар"},{id:"chem_r1_q24",q:"Бензол+Br₂(AlBr₃, катализатор)→",opts:["C₆H₅Br+HBr (орынбасу)", "C₆H₄Br₂+H₂", "C₆H₅Br₂", "C₆H₆Br₂"],ans:0,exp:"",topic:"Арендер"},{id:"chem_r1_q25",q:"CH₃COOH+NaOH→",opts:["CH₃COONa+H₂O", "CH₃ONa+CO₂", "CH₃OH+Na₂CO₃", "CO₂+H₂O"],ans:0,exp:"",topic:"Карбон қышқылы"},{id:"chem_r1_q26",q:"Эфир+H₂O(қышқыл катализатор)→",opts:["Спирт+карбон қышқылы", "Альдегид", "Кетон", "Ешнәрсе"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r1_q27",q:"Глюкоза спиртті ашу өнімдері:",opts:["C₂H₅OH+CO₂", "CH₃COOH+H₂", "CO₂+H₂O", "CH₄+CO₂"],ans:0,exp:"",topic:"Моносахаридтер"},{id:"chem_r1_q28",q:"Анилин сулы ертіндісінің қасиеті:",opts:["Әлсіз негіздік", "Күшті қышқылдық", "Бейтарап", "Амфотерлі"],ans:0,exp:"",topic:"N-бар органикалық"},{id:"chem_r1_q29",q:"Полиэтилен алу реакциясы:",opts:["Полимерлену", "Поликонденсация", "Гидрогенизация", "Гидролиз"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r1_q30",q:"4 г H₂ (M=2) мольдер саны:",opts:["2 моль", "4 моль", "0.5 моль", "1 моль"],ans:0,exp:"n=m/M=4/2=2",topic:"Есеп"},{id:"chem_r1_q31",q:"64 г Cu алынды, теориялық 80 г. Шығым %:",opts:["80%", "64%", "20%", "125%"],ans:0,exp:"η=64/80×100",topic:"Есеп"},{id:"chem_r1_q32",q:"2H₂+O₂→2H₂O. 4 моль H₂ үшін O₂:",opts:["2 моль", "4 моль", "1 моль", "8 моль"],ans:0,exp:"2:1 қатынас",topic:"Есеп"},{id:"chem_r1_q33",q:"EF: 40%C,6.7%H,53.3%O. Молекулалық формула (M=30):",opts:["CH₂O", "C₂H₄O₂", "C₃H₆O₃", "CH₄O"],ans:0,exp:"C:H:O=40/12:6.7/1:53.3/16=1:2:1, M=30→CH₂O",topic:"Формула"},{id:"chem_r1_q34",q:"Органикалық зат жанғанда 44г CO₂ және 18г H₂O. Молекула:",opts:["CH₄ (метан)", "C₂H₆", "C₃H₈", "C₂H₄"],ans:0,exp:"C=1 моль,H=2 моль→CH₄",topic:"Формула"},{id:"chem_r1_q35",q:"Темір пассивтенеді — концентрлі HNO₃ себебі:",opts:["Бетінде оксидті қорғаныш қабықша", "Реакция жоқ", "Fe балқиды", "NO₂ тоқтатады"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r1_q36",q:"Жасыл шай антиоксиданты — ол:",opts:["Тотығуды тежейді", "Тотығуды жылдамдатады", "рН артырады", "Катализатор"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r1_q37",q:"Ас содасы NaHCO₃ қыздырғанда:",opts:["Na₂CO₃+CO₂↑+H₂O", "NaOH+CO₂", "NaCl+H₂O", "NaO+H₂"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r1_q38",q:"Ауыр металлдар экологиялық қауіп себебі:",opts:["Ыдырамайды,тірі ағзада жинақталады", "Судан жеңіл", "Газ бөледі", "рН артырады"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r1_q39",q:"pH=3 ерітіндіде [H⁺]:",opts:["10⁻³ моль/л", "10⁻¹¹ моль/л", "3 моль/л", "0.003 г/л"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r1_q40",q:"Хлорлы әк Ca(OCl)Cl дезинфекциялайтын бөлік:",opts:["OCl⁻ (гипохлорит-ион)", "Ca²⁺", "Cl⁻", "OH⁻"],ans:0,exp:"",topic:"Контекст"}]},
{id:"chem_r2",title:"2-нұсқа",questions:[{id:"chem_r2_q1",q:"Cl атомының протондар саны:",opts:["17", "18", "16", "35"],ans:0,exp:"",topic:"Атом"},{id:"chem_r2_q2",q:"Иондық байланыс:",opts:["NaCl", "HCl", "H₂", "CO₂"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r2_q3",q:"sp²-гибридтелу — мысал:",opts:["C₂H₄", "CH₄", "C₂H₂", "C₆H₆"],ans:0,exp:"120°",topic:"Гибридтелу"},{id:"chem_r2_q4",q:"Бір топта жоғарыдан төменге иондану энергиясы:",opts:["Кемиді", "Артады", "Өзгермейді", "Тербеледі"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r2_q5",q:"Металл еместер кестенің қай жағында:",opts:["Жоғарғы оң", "Төменгі сол", "Орта", "Жоғарғы сол"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r2_q6",q:"KMnO₄ қышқыл ортада Mn тотығу дәрежесі:",opts:["Mn+7→Mn+2", "Mn+7→Mn+4", "Mn+7→Mn+6", "Mn+4→Mn+2"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r2_q7",q:"CuSO₄ ерітіндісін электролизде анодта:",opts:["O₂↑", "Cu↓", "H₂↑", "SO₃↑"],ans:0,exp:"H₂O тотығады",topic:"Электролиз"},{id:"chem_r2_q8",q:"Ле-Шателье: температура артса эндотермиялық реакция:",opts:["Оңға ығысады", "Солға ығысады", "Өзгеріс жоқ", "Баяулайды"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r2_q9",q:"Катализатор активтену энергиясын:",opts:["Азайтады", "Артырады", "Өзгертпейді", "Жояды"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r2_q10",q:"NH₃ судағы ерітіндісі рН:",opts:["рН>7", "рН<7", "рН=7", "рН=0"],ans:0,exp:"NH₃·H₂O — әлсіз негіз",topic:"Қышқыл-негіз"},{id:"chem_r2_q11",q:"FeCl₃ гидролизі ерітіндісі рН:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=0"],ans:0,exp:"Катионы гидролиздейді",topic:"Гидролиз"},{id:"chem_r2_q12",q:"Коррозиядан қорғау — катодтық тәсіл:",opts:["Белсенді металл (Zn) байлау", "Лак жабу", "Пассивтену", "Хромдау"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r2_q13",q:"Mg + H₂O (қыздырғанда)→",opts:["MgO+H₂↑", "Mg(OH)₂", "Mg(OH)Cl", "Реакция жоқ"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r2_q14",q:"CO₂+NaOH(артық)→",opts:["Na₂CO₃+H₂O", "NaHCO₃", "NaCO", "NaO+H₂"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r2_q15",q:"P₄O₁₀+H₂O→",opts:["H₃PO₄", "H₃PO₃", "HPO₃", "H₄P₂O₇"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r2_q16",q:"H₂S тотықтырғыш болса S тотығу дәрежесі өзгеруі:",opts:["S(-2→0)", "S(-2→+4)", "S(0→-2)", "S(+4→+6)"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r2_q17",q:"AgNO₃+HCl→ тұнба:",opts:["AgCl↓", "AgNO₂↓", "Ag↓", "Тұнба жоқ"],ans:0,exp:"Галогенид анықтау",topic:"XVII топ"},{id:"chem_r2_q18",q:"K₂Cr₂O₇+HCl(конц)→Cr тотығу дәрежесі өзгеруі:",opts:["Cr+6→Cr+3", "Cr+3→Cr+6", "Cr+2→Cr+6", "Cr+6→Cr+2"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r2_q19",q:"Алкандар химиялық белсенділігі:",opts:["Аз (галогендену реакциясы)", "Жоғары (қосылу реакциясы)", "Тотығу оңай", "Полимерлену оңай"],ans:0,exp:"",topic:"Алкандар"},{id:"chem_r2_q20",q:"HBr+CH₂=CH₂→ (Марковников):",opts:["CH₃-CH₂Br", "CH₂Br-CH₂Br", "CHBr₂-CH₃", "CH₂=CHBr"],ans:0,exp:"",topic:"Алкендер"},{id:"chem_r2_q21",q:"Толуол нитрлену бағыты:",opts:["Орто және пара (CH₃ тобы бағыттайды)", "Тек мета", "Тек пара", "Орынбасу жоқ"],ans:0,exp:"",topic:"Арендер"},{id:"chem_r2_q22",q:"CH₃OH+Na→",opts:["CH₃ONa+H₂↑", "NaOH+CH₃", "CH₃Na+OH", "CO+NaH₂"],ans:0,exp:"",topic:"Спирттер"},{id:"chem_r2_q23",q:"Альдегид Cu(OH)₂ қыздырғандағы тотығу өнімі:",opts:["Карбон қышқылы+Cu₂O↓", "Спирт", "Кетон", "Эфир"],ans:0,exp:"Күміс айна аналогы",topic:"Альдегидтер"},{id:"chem_r2_q24",q:"Крахмал+I₂→",opts:["Көк-күлгін түс", "Сары", "Ақ тұнба", "Жасыл газ"],ans:0,exp:"",topic:"Полисахаридтер"},{id:"chem_r2_q25",q:"Аминоқышқылдарды байланыстыратын байланыс:",opts:["Пептидтік (-CO-NH-)", "Эфирлік", "Сутектік", "Иондық"],ans:0,exp:"",topic:"N-бар органикалық"},{id:"chem_r2_q26",q:"Натуральді каучук мономері:",opts:["Изопрен (C₅H₈)", "Бутадиен", "Этилен", "Стирол"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r2_q27",q:"Мұнайды каталитикалық крекинг — мақсаты:",opts:["Жоғары молекулалы→жеңіл фракция", "Айдау", "Полимерлену", "Гидрлеу"],ans:0,exp:"",topic:"Мұнай"},{id:"chem_r2_q28",q:"36 г H₂O (M=18) мольдер саны:",opts:["2 моль", "4 моль", "1 моль", "18 моль"],ans:0,exp:"36/18=2",topic:"Есеп"},{id:"chem_r2_q29",q:"Fe+3Cl₂→2FeCl₃. 2 моль Fe үшін Cl₂ қажеты:",opts:["3 моль", "2 моль", "6 моль", "1 моль"],ans:0,exp:"2:3 қатынас",topic:"Есеп"},{id:"chem_r2_q30",q:"EF: 75%C, 25%H. Молекулалық формула:",opts:["CH₄", "C₂H₄", "C₃H₈", "C₂H₂"],ans:0,exp:"C:H=75/12:25/1=1:4→CH₄",topic:"Формула"},{id:"chem_r2_q31",q:"0.5 моль CaCO₃ ыдырағанда CO₂ (н.ж.) көлемі:",opts:["11.2 л", "22.4 л", "5.6 л", "44.8 л"],ans:0,exp:"0.5×22.4=11.2",topic:"Есеп"},{id:"chem_r2_q32",q:"Темір балқытудағы негізгі реакция:",opts:["Fe₂O₃+3CO→2Fe+3CO₂", "Fe+O₂→FeO", "FeO+C→Fe", "Fe₂O₃→Fe+O₂"],ans:0,exp:"",topic:"Есеп"},{id:"chem_r2_q33",q:"Аспирин (ацетилсалицил қышқылы) алу реакциясы:",opts:["Этерификация", "Гидролиз", "Нитрлену", "Тотығу"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q34",q:"Жуу ерітіндісі сілтілі болса майды:",opts:["Гидролиздейді (сабынданады)", "Тотықтырады", "Тоңазытады", "рН<7"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q35",q:"Қышқыл жауын рН<5.6 себебі:",opts:["SO₂,NOₓ судымен реакция", "CO₂", "О₃", "HF"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q36",q:"Литий-ионды аккумулятор катодтық материалы:",opts:["LiCoO₂", "Графит", "Li металл", "NiMH"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q37",q:"Антибиотиктер — химиялық сыныпты:",opts:["β-лактамдар,аминогликозидтер т.б.", "Тек пенициллин", "Тек стрептомицин", "Витамин"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q38",q:"Бензин октандық саны — не сипаттайды:",opts:["Детонацияға төзімділік", "Тұтануды", "Тұтқырлықты", "Тазалықты"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q39",q:"Озон қабатын бұзатын заттар:",opts:["Фреондар (ХФУ/CFC)", "CO₂", "CH₄", "N₂O"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r2_q40",q:"Полиэтилен теректеш қоршаған ортаны ластайды себебі:",opts:["Биологиялық ыдырамайды", "Улы газ бөледі", "Ауыр металл", "рН өзгертеді"],ans:0,exp:"",topic:"Контекст"}]},
{id:"chem_r3",title:"3-нұсқа",questions:[{id:"chem_r3_q1",q:"C атомының валенттілік электрондары:",opts:["4", "2", "3", "6"],ans:0,exp:"IV топ",topic:"Атом"},{id:"chem_r3_q2",q:"sp-гибридтелу — мысал:",opts:["C₂H₂ (ацетилен)", "C₂H₄", "CH₄", "C₆H₆"],ans:0,exp:"Сызықтық",topic:"Гибридтелу"},{id:"chem_r3_q3",q:"Металлдық байланыс ерекшелігі:",opts:["Делокализацияланған электрондар", "Ортақ электрон жұбы", "Электрон берілуі", "Ион"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r3_q4",q:"Бір периодта атом радиусы солдан оңға:",opts:["Кемиді", "Артады", "Өзгермейді", "Тербеледі"],ans:0,exp:"Протон артып, тартылыс күшейеді",topic:"Периодтық"},{id:"chem_r3_q5",q:"Электртерістілік ең жоғары элемент:",opts:["F", "O", "N", "Cl"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r3_q6",q:"Zn+H₂SO₄(сұйытылған)→",opts:["ZnSO₄+H₂↑", "ZnO+SO₂+H₂O", "ZnS+H₂O", "Реакция жоқ"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r3_q7",q:"H₂O электролизде катодта:",opts:["H₂↑", "O₂↑", "OH⁻", "H⁺"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r3_q8",q:"Тепе-теңдік константасы K > 1 болса реакция:",opts:["Өнімдер жағына ауысқан", "Реагенттер жағына", "Тепе-теңдік жоқ", "K байланысы жоқ"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r3_q9",q:"Реакция жылдамдығы концентрация артса:",opts:["Артады", "Кемиді", "Өзгермейді", "Нөлге дейін кемиді"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r3_q10",q:"Буферлік ерітінді дегеніміз:",opts:["рН-ты тұрақты ұстайтын", "Қышқыл+сілті", "Тек суда ериді", "Ерімейтін"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r3_q11",q:"Na₂SO₄ гидролиз жүреді ме:",opts:["Жоқ (күшті қышқыл+күшті негіз тұзы)", "Иә,қышқыл", "Иә,сілтілік", "Толық гидролиз"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r3_q12",q:"Металлдар белсенділік қатары — Mg пен Cu:",opts:["Mg>Cu (Mg белсендірек)", "Cu>Mg", "Тең", "Тәуелді"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r3_q13",q:"Ca+H₂O(суық)→",opts:["Ca(OH)₂+H₂↑", "CaO+H₂", "CaH₂+O₂", "Реакция жоқ"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r3_q14",q:"Al₂O₃+NaOH(ерітінді)→",opts:["NaAlO₂+H₂O", "Al+Na₂O", "AlH₃+NaOH", "Al(OH)₃↓"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r3_q15",q:"N₂+O₂→ реакция шарты:",opts:["Жоғары t° немесе найзағай", "Бөлме температурасы", "Суда", "Қышқылда"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r3_q16",q:"SO₂+H₂O→",opts:["H₂SO₃", "H₂SO₄", "H₂S", "SO₃"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r3_q17",q:"Mg+Cl₂→",opts:["MgCl₂", "MgClO", "Mg₂Cl", "MgCl"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r3_q18",q:"Хромат-дихромат тепе-теңдік рН-мен:",opts:["CrO₄²⁻⇌Cr₂O₇²⁻: қышқылда дихромат", "Өзгермейді", "Тек t°-дан", "Жоқ"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r3_q19",q:"Алкин — жалпы формуласы:",opts:["CₙH₂ₙ₋₂", "CₙH₂ₙ₊₂", "CₙH₂ₙ", "CₙHₙ"],ans:0,exp:"",topic:"Алкиндер"},{id:"chem_r3_q20",q:"Дегидратация этанол 170°C-та:",opts:["CH₂=CH₂+H₂O (алкен)", "C₂H₅OC₂H₅", "CH₃CHO", "CH₃COOH"],ans:0,exp:"",topic:"Спирттер"},{id:"chem_r3_q21",q:"Ацетальдегид тотығу өнімі:",opts:["CH₃COOH (сірке қышқылы)", "CH₃CH₂OH", "CO₂+H₂O", "CH₂=O"],ans:0,exp:"",topic:"Альдегидтер"},{id:"chem_r3_q22",q:"Майлар гидролизі өнімдері:",opts:["Глицерин+жоғарғы қышқылдар (сабынданды)", "Глюкоза+фруктоза", "Крахмал", "Целлюлоза"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r3_q23",q:"Сахароза+H₂O(H⁺ катализатор)→",opts:["Глюкоза+фруктоза", "Тек глюкоза", "Крахмал", "Мальтоза"],ans:0,exp:"",topic:"Полисахаридтер"},{id:"chem_r3_q24",q:"Белок денатурациясы:",opts:["3D-құрылымы бұзылады (химиялық байланыстар)", "Пептидтік байланыс үзіледі", "Аминоқышқылдарға ыдырайды", "Тек физикалық"],ans:0,exp:"",topic:"N-бар органикалық"},{id:"chem_r3_q25",q:"Нейлон-66 полимерлену типі:",opts:["Поликонденсация", "Полимерлену", "Радикальді", "Иондық"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r3_q26",q:"Мұнайды атмосфералық айдауда бөлінеді:",opts:["Бензин,керосин,дизель,мазут фракциялары", "Тек бензин", "Тек газ", "Тек мазут"],ans:0,exp:"",topic:"Мұнай"},{id:"chem_r3_q27",q:"Шығымы 75%, теориялық 120 г. Нақты өнім:",opts:["90 г", "75 г", "120 г", "100 г"],ans:0,exp:"120×0.75=90",topic:"Есеп"},{id:"chem_r3_q28",q:"1 моль H₂SO₄ бейтараптауға NaOH қажеты:",opts:["2 моль", "1 моль", "0.5 моль", "3 моль"],ans:0,exp:"H₂SO₄+2NaOH",topic:"Есеп"},{id:"chem_r3_q29",q:"EF: 80%C, 20%H (M=30). Формуласы:",opts:["C₂H₆", "CH₄", "C₃H₈", "C₂H₄"],ans:0,exp:"C:H=80/12:20/1=1:3, EF=CH₃, n=2",topic:"Формула"},{id:"chem_r3_q30",q:"Мочевина CO(NH₂)₂ — өнеркәсіпте:",opts:["Тыңайтқыш ретінде", "Антибиотик", "Полимер", "Еріткіш"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q31",q:"ПЭТ (полиэтилентерефталат) — қолданылады:",opts:["Сусын бөтелкелері,тоқыма", "Тек тоқыма", "Тек бөтелке", "Электроника"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q32",q:"Глюкозаның биологиялық маңызы:",opts:["Негізгі энергия көзі (гликолиз,ТЦА)", "Тек тамақ", "Тек фотосинтез", "Тек тыныс"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q33",q:"Кальций карбонаты мрамор:",opts:["CaCO₃+2HCl→CaCl₂+CO₂↑+H₂O", "Ca+HCl", "CaO+CO₂", "Реакция жоқ"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q34",q:"Темір мен хлорсутек:",opts:["Fe+2HCl→FeCl₂+H₂↑ (Иә, жүреді)", "Жоқ", "Тек қызуда", "FeCl₃"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q35",q:"Жалын бояуы: Na+→",opts:["Сары (589 нм)", "Қызыл", "Жасыл", "Күлгін"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q36",q:"Хлор — ауыз суды тазарту механизмі:",opts:["HOCl бөлініп бактерицидтік əсер", "Тек рН", "Тек иіс", "Флокуляция"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q37",q:"Химиялық жану — бұл:",opts:["Жылдам тотығу реакциясы", "Баяу коррозия", "Фотосинтез", "Гидролиз"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q38",q:"Азот циклі: нитрификация — бактериялар:",opts:["NH₃→NO₃⁻ (нитробактериялар)", "N₂→NH₃", "NO₃⁻→N₂", "NH₃→N₂"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q39",q:"Парниктік эффект тудыратын негізгі газ:",opts:["CO₂ (метан,N₂O да)", "O₂", "N₂", "H₂"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r3_q40",q:"Фреондар (CFC) — экологиялық зияны:",opts:["Озон қабатын бұзады", "Жылынуды тудырады", "Ауаны тазалайды", "Ешнәрсе"],ans:0,exp:"",topic:"Контекст"}]},
{id:"chem_r4",title:"4-нұсқа",questions:[{id:"chem_r4_q1",q:"O атомының салыстырмалы атомдық массасы:",opts:["16", "8", "18", "32"],ans:0,exp:"",topic:"Атом"},{id:"chem_r4_q2",q:"Молекулааралық сутектік байланыс бар зат:",opts:["H₂O", "CH₄", "CO₂", "N₂"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r4_q3",q:"σ-байланыстар саны C₂H₄ молекуласында:",opts:["5", "4", "6", "3"],ans:0,exp:"2σ(C-H)×2+1σ(C-C)=5",topic:"Байланыс"},{id:"chem_r4_q4",q:"Иондану энергиясы — анықтамасы:",opts:["Газ атомынан 1 электрон алу энергиясы", "Электрон қосу энергиясы", "Байланыс энергиясы", "Иондар арасы"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r4_q5",q:"Бір топта жоғарыдан төменге металл қасиеттер:",opts:["Артады", "Кемиді", "Өзгермейді", "Тербеледі"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r4_q6",q:"MnO₄⁻+8H⁺+5e⁻→Mn²⁺+4H₂O. Процесс:",opts:["Тотықсыздану (Mn+7→Mn+2)", "Тотығу", "Ион алмасу", "Гидролиз"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r4_q7",q:"CuSO₄ ерітіндісі электролизде катодта:",opts:["Cu↓", "O₂↑", "H₂↑", "SO₄²⁻"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r4_q8",q:"N₂+3H₂⇌2NH₃. H₂ концентрациясы артса:",opts:["Тепе-теңдік оңға (NH₃ артады)", "Солға", "Өзгеріс жоқ", "Температурадан тәуелді"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r4_q9",q:"Реакция жылдамдығы заттардың:",opts:["Концентрациясы мен температурасына тәуелді", "Тек концентрацияға", "Тек температурага", "Тек катализаторға"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r4_q10",q:"HClO₄,H₂SO₄,HNO₃,HF — күшті қышқылдар (сулы ерітінді):",opts:["HClO₄,H₂SO₄,HNO₃ (HF — әлсіз)", "Барлығы күшті", "Тек HClO₄", "Барлығы тең"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r4_q11",q:"CH₃COONa гидролиз ортасы:",opts:["рН>7 (сілтілік)", "рН<7", "рН=7", "рН=0"],ans:0,exp:"Анионды гидролиз",topic:"Гидролиз"},{id:"chem_r4_q12",q:"Na пен H₂O реакциясы:",opts:["2Na+2H₂O→2NaOH+H₂↑", "Na+H₂O→NaOH", "Na₂O+H₂", "Na(OH)₂"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r4_q13",q:"Cl₂+NaOH(суық,сұйытылған)→",opts:["NaCl+NaOCl+H₂O", "NaClO₃+H₂O", "NaCl+O₂", "NaClO₄"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r4_q14",q:"Жоғарғы оксиді қышқылдық қасиет көрсетеді:",opts:["SO₃,P₂O₅,N₂O₅", "Na₂O,MgO", "Al₂O₃", "Тек SO₃"],ans:0,exp:"",topic:"XIV-XVI топ"},{id:"chem_r4_q15",q:"NH₃+HCl→",opts:["NH₄Cl", "N₂+HCl+H₂O", "NH₂Cl", "NH₄OH+Cl"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r4_q16",q:"H₂SO₄(сұйытылған)+Zn→",opts:["ZnSO₄+H₂↑", "ZnO+SO₂", "ZnS+H₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r4_q17",q:"Хлор галогендерінен ерекше — ең:",opts:["белсенді (F-тан кейін)", "Белсенді емес", "Нейтраль", "Базалық"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r4_q18",q:"Fe₂O₃+HNO₃(сұйытылған)→",opts:["Fe(NO₃)₃+H₂O", "Fe(NO₃)₂+H₂", "FeO+NO₂", "Fe+H₂O"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r4_q19",q:"Изомерия дегеніміз:",opts:["Бірдей молекулалық формула,бірақ əртүрлі құрылым", "Бірдей формула,бірдей құрылым", "Əртүрлі формула", "Гомологтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r4_q20",q:"Этанолды тотықтырса (жеңіл):",opts:["CH₃CHO (ацетальдегид)", "CH₃COOH", "CO₂+H₂O", "C₂H₄"],ans:0,exp:"",topic:"Спирттер"},{id:"chem_r4_q21",q:"Фенол+NaOH→",opts:["C₆H₅ONa+H₂O", "C₆H₅NO₂+H₂O", "C₆H₆+NaOH", "C₆H₅Cl"],ans:0,exp:"",topic:"Фенол"},{id:"chem_r4_q22",q:"Карбон қышқылы+спирт(H⁺,t°)→",opts:["Эфир+H₂O (этерификация)", "Альдегид", "Кетон", "CO₂"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r4_q23",q:"Целлюлоза ерекшелігі:",opts:["β-гликозидтік байланыс,сызықтық", "α-гликозидтік,тармақталған", "Моносахарид", "Дисахарид"],ans:0,exp:"",topic:"Полисахаридтер"},{id:"chem_r4_q24",q:"Аминоқышқыл — амфотерлік:",opts:["Бір молекулада NH₂ де, COOH да бар", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"N-бар органикалық"},{id:"chem_r4_q25",q:"Резина (вулканизация) — бұл:",opts:["Каучук+күкірт (поперечні байланыстар)", "Қыздыру", "Полимерлену", "Суытқыш"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r4_q26",q:"Нафта крекингі температурасы:",opts:["500-600°C (термиялық)", "100°C", "1000°C", "200°C"],ans:0,exp:"",topic:"Мұнай"},{id:"chem_r4_q27",q:"112 г Fe (M=56) мольдер саны:",opts:["2 моль", "4 моль", "1 моль", "0.5 моль"],ans:0,exp:"112/56=2",topic:"Есеп"},{id:"chem_r4_q28",q:"2 моль Fe + 3 моль Cl₂ → 2 моль FeCl₃. Молярлық масса FeCl₃=162.2г. Масса:",opts:["324.4 г", "162.2 г", "486.6 г", "81.1 г"],ans:0,exp:"2×162.2",topic:"Есеп"},{id:"chem_r4_q29",q:"Органикалық зат: жандырғанда 88г CO₂ (M=44) және 36г H₂O. Формуласы:",opts:["C₂H₄ (этилен)", "CH₄", "C₂H₆", "C₃H₈"],ans:0,exp:"n(C)=2, n(H)=4→C₂H₄",topic:"Формула"},{id:"chem_r4_q30",q:"Нан пісіру — CO₂ неден бөлінеді:",opts:["Ашытқы (дрожжи) ашу реакциясы", "Тек сода", "Тек пісіру", "Ешнәрсе"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q31",q:"Дәрі — парацетамол (ацетаминофен) сыныбы:",opts:["Анальгетик-антипиретик", "Антибиотик", "Антигистамин", "Витамин"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q32",q:"Вода тазалау — коагуляция:",opts:["Al₂(SO₄)₃ қосу (Al(OH)₃ тұнба)", "Хлорлау", "рН реттеу", "Озондау"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q33",q:"Цемент — химиялық негізі:",opts:["Кальций силикаттары мен алюминаттары", "Тек SiO₂", "Тек CaCO₃", "CaCl₂"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q34",q:"Тұз — осмос давление регулятор:",opts:["Жасушалық изоосмос ұстайды", "Тек тамақ", "Тек реакция", "Тек pH"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q35",q:"Сабын (soap) — химиялық типі:",opts:["Майлы қышқылдардың натрий/калий тұздары", "Эфир", "Альдегид", "Спирт"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q36",q:"Катализатор деп аталатын — белоктар:",opts:["Ферменттер (биокатализаторлар)", "Гормондар", "Липидтер", "Нуклеин"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q37",q:"CO улы — механизмі:",opts:["Гемоглобинмен берік байланысады (CO>O₂)", "Жасушаны жояды", "рН өзгертеді", "Тотықтырады"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q38",q:"Натрий гидрокарбонаты — антацид:",opts:["Асқазан қышқылын бейтараптайды", "Бактерицид", "Анестетик", "Антибиотик"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r4_q39",q:"Пластмасса тозаңдатылса ластаушы:",opts:["Микропластик (биол. ыдырамайды)", "Тек визуальді", "Газ", "рН"],ans:0,exp:"",topic:"Контекст"}]},
{id:"chem_r5",title:"5-нұсқа",questions:[{id:"chem_r5_q1",q:"Ne атомының электрондар саны:",opts:["10", "8", "18", "2"],ans:0,exp:"Z=10",topic:"Атом"},{id:"chem_r5_q2",q:"Полярлы еміс ковалентті байланыс:",opts:["N₂", "HCl", "NaCl", "H₂O"],ans:0,exp:"N≡N",topic:"Байланыс"},{id:"chem_r5_q3",q:"Молекулааралық ван-дер-Ваальс күші ең әлсіз:",opts:["Иә, ең әлсіз байланыс типі", "Иондық сияқты", "Ковалентті сияқты", "Металлдық"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r5_q4",q:"Электрлік теріс мәні Li,Na,K ретімен:",opts:["Кемиді (Li ең жоғары)", "Артады", "Өзгермейді", "Циклді"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r5_q5",q:"Радиус ең кіші — бір периодта:",opts:["Жоғарғы зарядты металл емес", "Сілтілік металл", "Ауыспалы металл", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r5_q6",q:"ТТР теңдестіру — электрондар балансы:",opts:["Берілген электрон = алынған электрон", "Тек масса", "Тек заряд", "Тек сан"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r5_q7",q:"Al электролизде (балқытылған Al₂O₃) катодта:",opts:["Al↓", "O₂↑", "Al³⁺", "Al²O₃"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r5_q8",q:"2SO₂+O₂⇌2SO₃. Қысым азайса:",opts:["Солға ығысады (газ моль саны артатын жаққа)", "Оңға", "Өзгеріс жоқ", "Тепе-теңдік бұзылады"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r5_q9",q:"Гомогендік катализ дегеніміз:",opts:["Катализатор мен реагент бір фазада", "Əртүрлі фазада", "Тек газ фазасы", "Тек сұйық"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r5_q10",q:"Lewis қышқылы:",opts:["Электрон жұбын қабылдаушы", "Протон беруші", "OH⁻ бөлетін", "Протон алушы"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r5_q11",q:"Тұз+су→қышқыл+негіз. Мысал:",opts:["CH₃COONa+H₂O⇌CH₃COOH+NaOH", "NaCl+H₂O", "Na₂SO₄+H₂O", "KNO₃+H₂O"],ans:0,exp:"Анионды гидролиз",topic:"Гидролиз"},{id:"chem_r5_q12",q:"Al₂O₃ — амфотерлі мысалы:",opts:["HCl-мен де, NaOH-мен де реакцияласады", "Тек NaOH", "Тек HCl", "Тек H₂O"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r5_q13",q:"Na₂O₂ + H₂O →",opts:["NaOH + O₂↑", "Na₂O + H₂", "Na + OH", "NaOH + H₂O₂"],ans:0,exp:"2Na₂O₂+2H₂O→4NaOH+O₂",topic:"I-III топ"},{id:"chem_r5_q14",q:"B₂O₃ қасиеті:",opts:["Қышқылдық оксид (H₃BO₃ береді)", "Негіздік", "Амфотерлі", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r5_q15",q:"NO₂+H₂O→",opts:["HNO₃+HNO₂", "HNO₃", "HNO₂", "N₂O₄"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r5_q16",q:"H₂SO₄(конц) органикалық заттарды:",opts:["Карбонизациялайды (C бөледі — сусыздандыру)", "Еріту", "Тотықтырмайды", "Бейтараптайды"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r5_q17",q:"Бром суы — бромды анықтау:",opts:["Қоңыр-сары (Br₂ еркін)", "Ақ тұнба", "Көк", "Жасыл"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r5_q18",q:"Cr₂O₇²⁻+H₂O₂+H₂SO₄ → H₂CrO₄ типі:",opts:["Тотығу-тотықсыздану", "Ион алмасу", "Гидролиз", "Бейтараптану"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r5_q19",q:"Пентан изомерлер саны:",opts:["3 (н-пентан,изопентан,неопентан)", "2", "5", "4"],ans:0,exp:"",topic:"Алкандар"},{id:"chem_r5_q20",q:"Алкил тобы (–CH₃, –C₂H₅) — атауы:",opts:["Метил, этил...", "Метен, этен", "Метин, этин", "Метан, этан"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r5_q21",q:"Этин (ацетилен)+H₂O(HgSO₄,H₂SO₄)→",opts:["CH₃CHO (Кучеров реакциясы)", "C₂H₅OH", "CH₂=CH₂", "C₂H₄"],ans:0,exp:"",topic:"Алкиндер"},{id:"chem_r5_q22",q:"Глицерин+HNO₃(конц)→",opts:["Нитроглицерин (жарылғыш)", "Глицерин нитраты", "Глицерол", "CO₂+H₂O"],ans:0,exp:"",topic:"Спирттер"},{id:"chem_r5_q23",q:"Кетон — сипаты:",opts:["C=O тобы тізбек ортасында", "C=O тобы шеткі атомда", "Бір COOH", "Тек циклді"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r5_q24",q:"Крахмалдың молекулалық формуласы:",opts:["(C₆H₁₀O₅)ₙ", "C₆H₁₂O₆", "C₁₂H₂₂O₁₁", "(C₆H₁₂O₆)ₙ"],ans:0,exp:"",topic:"Полисахаридтер"},{id:"chem_r5_q25",q:"ДНҚ-дағы азотты негіздер:",opts:["А,Т,Г,Ц (Урацил жоқ)", "А,У,Г,Ц", "А,Т,Г,Ц,У", "А,Т,Г"],ans:0,exp:"РНҚ-да Урацил",topic:"N-бар органикалық"},{id:"chem_r5_q26",q:"Термопластик пластмасса:",opts:["Қыздырса жұмсарады (полиэтилен)", "Қыздырса қатаяды", "Ерімейді", "Тек металлдармен"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r5_q27",q:"Мұнай — органикалық шығу теориясы:",opts:["Жануарлар қалдықтарынан (биологиялық)", "Тек минералдық", "Тек синтез", "Тас жаңбырынан"],ans:0,exp:"",topic:"Мұнай"},{id:"chem_r5_q28",q:"10 г CaCO₃ (M=100) ыдырағанда CO₂:",opts:["2.24 л", "22.4 л", "11.2 л", "0.224 л"],ans:0,exp:"n=0.1→V=2.24",topic:"Есеп"},{id:"chem_r5_q29",q:"Шығым 90%, 50 г теориялық. Нақты:",opts:["45 г", "50 г", "40 г", "55 г"],ans:0,exp:"50×0.9=45",topic:"Есеп"},{id:"chem_r5_q30",q:"Зат 60%C, 13.3%H, 26.7%O (M=90). Формуласы:",opts:["C₅H₁₂O (пентанол)", "C₄H₁₀O", "C₃H₈O", "C₆H₁₄O"],ans:0,exp:"C:H:O=5:16:2... M=90→C₅H₁₂O",topic:"Формула"},{id:"chem_r5_q31",q:"Тамақтық хромосомалар — тамақ бояуы:",opts:["Кейбіреулері канцерогенді (тест жүргізу керек)", "Барлығы қауіпсіз", "Барлығы зиянды", "Тек синтетик"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q32",q:"Биопластик — экологиялық артықшылығы:",opts:["Биологиялық ыдырайды (крахмалдан)", "Мықтырақ", "Арзанырақ", "Мөлдір"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q33",q:"Гальваника — мысал:",opts:["Темірді никельмен/хроммен жабу", "Электрлік тотығу", "Тот басу", "Коррозия"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q34",q:"Жасушалық мембрана — негізгі компонент:",opts:["Фосфолипидтер мен белоктар", "Тек белоктар", "Тек майлар", "Тек полисахаридтер"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q35",q:"Биодизель — алынады:",opts:["Өсімдік майын этанолмен трансэтерификация", "Мұнайды крекинг", "Көмірді газификация", "Синтетикалық"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q36",q:"Нанотехнология — нанобөлшек өлшемі:",opts:["1-100 нм", "1-100 мм", "1-100 мкм", "1-100 пм"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q37",q:"Сутек отыны (H₂ fuel cell) — реакция:",opts:["H₂+½O₂→H₂O (электр энергиясы бөлінеді)", "H₂+O₂→H₂O₂", "Жану тек", "CO₂ бөлінеді"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q38",q:"Антикоррозиялық жабындар — мысал:",opts:["Цинклеу (galvanizing)", "Тек бояу", "Тек лак", "Тек пластик"],ans:0,exp:"",topic:"Контекст"},{id:"chem_r5_q39",q:"Изотоп дегеніміз:",opts:["Бірдей Z, бірақ əртүрлі A (нейтрондар)", "Бірдей A,əртүрлі Z", "Бірдей ZжəнеA", "Əртүрлі элемент"],ans:0,exp:"",topic:"Контекст"}]},
{id:"chem_r6",title:"6-нұсқа",questions:[{id:"chem_r6_q1",q:"Нұсқа 6: K атомында электрондар (Z=19):",opts:["19", "18", "20", "39"],ans:0,exp:"",topic:"Атом"},{id:"chem_r6_q2",q:"Нұсқа 6: Изотоп мысалы:",opts:["¹H мен ²H (дейтерий)", "Na мен K", "Fe мен Co", "O мен S"],ans:0,exp:"",topic:"Атом"},{id:"chem_r6_q3",q:"Нұсқа 6: σ-байланыс саны CH₃-CH₃ (этан):",opts:["7", "6", "8", "5"],ans:0,exp:"3+3+1=7",topic:"Байланыс"},{id:"chem_r6_q4",q:"Нұсқа 6: Водородтық байланыс — қатысады:",opts:["H-F, H-O, H-N", "H-Cl", "H-S", "H-C"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r6_q5",q:"Нұсқа 6: IV период 1-ші элемент:",opts:["K (калий)", "Ca", "Sc", "Ar"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r6_q6",q:"Нұсқа 6: Ең кіші атом радиусы бір периодта:",opts:["Жоғары заряды (инертті газ емес)", "Сілтілік металл", "Ауыспалы", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r6_q7",q:"Нұсқа 6: 2Fe+3Cl₂→2FeCl₃. Fe тотығу дәрежесі:",opts:["Fe: 0→+3", "Fe: 0→+2", "Cl: 0→-1 (тотықсыздану)", "Fe: +2→+3"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r6_q8",q:"Нұсқа 6: Тотықтырғыш — ол:",opts:["Электрон алады", "Электрон береді", "Протон береді", "Нейтроны бар"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r6_q9",q:"Нұсқа 6: H₂SO₄(сұйытылған) электролизінде анодта:",opts:["O₂↑", "H₂↑", "SO₃", "H₂SO₄"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r6_q10",q:"Нұсқа 6: Электролиз — Cu алу:",opts:["CuSO₄ ерітіндісін электролиздеу", "Балқытудан", "Термодинамика", "Кинетика"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r6_q11",q:"Нұсқа 6: Тепе-теңдік константасы K — температура артса эндотермиялық реакция:",opts:["K артады", "K кемиді", "K өзгермейді", "K=0"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r6_q12",q:"Нұсқа 6: Гомогендік тепе-теңдікте:",opts:["Барлығы бір фазада", "Əртүрлі фазада", "Тек газ", "Тек сұйық"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r6_q13",q:"Нұсқа 6: Реакция жылдамдығы теңдеуі:",opts:["v=k[A]ᵐ[B]ⁿ", "v=k[A]+[B]", "v=k", "v=k/[A]"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r6_q14",q:"Нұсқа 6: Температуралық коэффициент γ=2 болса, Т 30°C артса жылдамдық:",opts:["8 есе артады (2³)", "2 есе", "4 есе", "27 есе"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r6_q15",q:"Нұсқа 6: рН=7 ерітіндіде [OH⁻]:",opts:["10⁻⁷ моль/л", "10⁻¹⁴ моль/л", "1 моль/л", "7 моль/л"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r6_q16",q:"Нұсқа 6: Индикатор фенолфталеин сілтілік ортада:",opts:["Қызыл-күлгін", "Түссіз", "Сары", "Көк"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r6_q17",q:"Нұсқа 6: AlCl₃ гидролизінен ерітінді ортасы:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r6_q18",q:"Нұсқа 6: Гидролизді жылдамдататын жағдай:",opts:["Температура артса", "Температура азайса", "рН=7", "Концентрация азайса"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r6_q19",q:"Нұсқа 6: Металлдар ішінде ең жоғары өткізгіш:",opts:["Ag (күміс)", "Cu", "Au", "Al"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r6_q20",q:"Нұсқа 6: Fe+CuSO₄→ реакция мүмкін бе:",opts:["Иə (Fe>Cu белсенділік)", "Жоқ", "Тек конц.", "Тек t°"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r6_q21",q:"Нұсқа 6: Li,Na,K — қасиет:",opts:["Жұмсақ металлдар,суда еритін гидроксид", "Қатты", "Суда ерімейтін", "Инертті"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r6_q22",q:"Нұсқа 6: Be(OH)₂ қасиеті:",opts:["Амфотерлі", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r6_q23",q:"Нұсқа 6: CO+O₂→ өнімі:",opts:["CO₂", "CO₃", "C+O₂", "COH"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r6_q24",q:"Нұсқа 6: SiO₂+NaOH→",opts:["Na₂SiO₃+H₂O", "SiNaO", "Si+Na₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r6_q25",q:"Нұсқа 6: Аммиак алу (Haber процесі):",opts:["N₂+3H₂→2NH₃ (Fe катализаторы)", "N₂+O₂→NO", "NH₃+O₂→NO", "N₂+H₂O→NH₃"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r6_q26",q:"Нұсқа 6: HNO₃(сұйытылған)+Fe→",opts:["Fe(NO₃)₂+NO+H₂O", "Fe(NO₃)₃+NO₂", "FeNO₃", "Fe+H₂"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r6_q27",q:"Нұсқа 6: SO₃+H₂O→",opts:["H₂SO₄", "H₂SO₃", "H₂S", "SO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r6_q28",q:"Нұсқа 6: H₂S — ертіндісі рН:",opts:["рН<7 (қышқылдық)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r6_q29",q:"Нұсқа 6: Cl₂+2KBr→",opts:["2KCl+Br₂ (Cl>Br белсенділік)", "KClO+KBr", "KBrCl+H₂", "Реакция жоқ"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r6_q30",q:"Нұсқа 6: HF — ерекшелігі:",opts:["Шынымен əрекеттеседі (SiO₂),сutе уытты", "Ең күшті қышқыл", "Тот баспайды", "Ерімейді"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r6_q31",q:"Нұсқа 6: CrO₄²⁻ сары түсті, Cr₂O₇²⁻ — түсі:",opts:["Қызғылт-сары (оранжевый)", "Жасыл", "Көк", "Күлгін"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r6_q32",q:"Нұсқа 6: Кешен тұздың иондану:",opts:["[Cu(NH₃)₄]SO₄→[Cu(NH₃)₄]²⁺+SO₄²⁻", "Тек Cu²⁺ бөлінеді", "Тек SO₄²⁻", "Ыдырамайды"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r6_q33",q:"Нұсқа 6: Алкандар — тізбек ережесі:",opts:["Sp³-гибридтелу,σ-байланыс,стация", "sp²", "sp", "Аралас"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r6_q34",q:"Нұсқа 6: Гомолог деп аталады:",opts:["CH₂ тобынан айырмасы бар бір қатардың мүшелері", "Изомерлер", "Бірдей формула", "Əртүрлі топтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r6_q35",q:"Нұсқа 6: CH₃COOCH₂CH₃ — атауы:",opts:["Этилацетат (этилсірке эфирі)", "Метилацетат", "Этилформиат", "Метилпропионат"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r6_q36",q:"Нұсқа 6: Глюкоза+O₂→ (клетка тыныс алуы):",opts:["6CO₂+6H₂O+38АТФ", "C₂H₅OH+CO₂", "CH₄+H₂O", "CO+H₂O"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r6_q37",q:"Нұсқа 6: Поливинилхлорид (ПВХ) мономері:",opts:["CH₂=CHCl", "CH₂=CH₂", "CHCl₃", "C₂H₄"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r6_q38",q:"Нұсқа 6: Тефлон (ПТФЭ) полимер:",opts:["-(CF₂-CF₂)ₙ- (тфлон,жабысқақ емес)", "-(CH₂)ₙ-", "-(NH-CO)ₙ-", "Нейлон"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r6_q39",q:"Нұсқа 6: 22.4 л (н.ж.) кез-келген газ мольдер саны:",opts:["1 моль", "2 моль", "0.5 моль", "22.4 моль"],ans:0,exp:"Авогадро заңы",topic:"Есеп"},{id:"chem_r6_q40",q:"Нұсқа 6: Зат 92%C, 8%H (M=26). Формуласы:",opts:["C₂H₂ (ацетилен)", "CH₄", "C₂H₄", "C₂H₆"],ans:0,exp:"C:H=92/12:8/1=7.67:8≈1:1, n=2→C₂H₂",topic:"Формула"}]},
{id:"chem_r7",title:"7-нұсқа",questions:[{id:"chem_r7_q1",q:"Нұсқа 7: K атомында электрондар (Z=19):",opts:["19", "18", "20", "39"],ans:0,exp:"",topic:"Атом"},{id:"chem_r7_q2",q:"Нұсқа 7: Изотоп мысалы:",opts:["¹H мен ²H (дейтерий)", "Na мен K", "Fe мен Co", "O мен S"],ans:0,exp:"",topic:"Атом"},{id:"chem_r7_q3",q:"Нұсқа 7: σ-байланыс саны CH₃-CH₃ (этан):",opts:["7", "6", "8", "5"],ans:0,exp:"3+3+1=7",topic:"Байланыс"},{id:"chem_r7_q4",q:"Нұсқа 7: Водородтық байланыс — қатысады:",opts:["H-F, H-O, H-N", "H-Cl", "H-S", "H-C"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r7_q5",q:"Нұсқа 7: IV период 1-ші элемент:",opts:["K (калий)", "Ca", "Sc", "Ar"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r7_q6",q:"Нұсқа 7: Ең кіші атом радиусы бір периодта:",opts:["Жоғары заряды (инертті газ емес)", "Сілтілік металл", "Ауыспалы", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r7_q7",q:"Нұсқа 7: 2Fe+3Cl₂→2FeCl₃. Fe тотығу дәрежесі:",opts:["Fe: 0→+3", "Fe: 0→+2", "Cl: 0→-1 (тотықсыздану)", "Fe: +2→+3"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r7_q8",q:"Нұсқа 7: Тотықтырғыш — ол:",opts:["Электрон алады", "Электрон береді", "Протон береді", "Нейтроны бар"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r7_q9",q:"Нұсқа 7: H₂SO₄(сұйытылған) электролизінде анодта:",opts:["O₂↑", "H₂↑", "SO₃", "H₂SO₄"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r7_q10",q:"Нұсқа 7: Электролиз — Cu алу:",opts:["CuSO₄ ерітіндісін электролиздеу", "Балқытудан", "Термодинамика", "Кинетика"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r7_q11",q:"Нұсқа 7: Тепе-теңдік константасы K — температура артса эндотермиялық реакция:",opts:["K артады", "K кемиді", "K өзгермейді", "K=0"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r7_q12",q:"Нұсқа 7: Гомогендік тепе-теңдікте:",opts:["Барлығы бір фазада", "Əртүрлі фазада", "Тек газ", "Тек сұйық"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r7_q13",q:"Нұсқа 7: Реакция жылдамдығы теңдеуі:",opts:["v=k[A]ᵐ[B]ⁿ", "v=k[A]+[B]", "v=k", "v=k/[A]"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r7_q14",q:"Нұсқа 7: Температуралық коэффициент γ=2 болса, Т 30°C артса жылдамдық:",opts:["8 есе артады (2³)", "2 есе", "4 есе", "27 есе"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r7_q15",q:"Нұсқа 7: рН=7 ерітіндіде [OH⁻]:",opts:["10⁻⁷ моль/л", "10⁻¹⁴ моль/л", "1 моль/л", "7 моль/л"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r7_q16",q:"Нұсқа 7: Индикатор фенолфталеин сілтілік ортада:",opts:["Қызыл-күлгін", "Түссіз", "Сары", "Көк"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r7_q17",q:"Нұсқа 7: AlCl₃ гидролизінен ерітінді ортасы:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r7_q18",q:"Нұсқа 7: Гидролизді жылдамдататын жағдай:",opts:["Температура артса", "Температура азайса", "рН=7", "Концентрация азайса"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r7_q19",q:"Нұсқа 7: Металлдар ішінде ең жоғары өткізгіш:",opts:["Ag (күміс)", "Cu", "Au", "Al"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r7_q20",q:"Нұсқа 7: Fe+CuSO₄→ реакция мүмкін бе:",opts:["Иə (Fe>Cu белсенділік)", "Жоқ", "Тек конц.", "Тек t°"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r7_q21",q:"Нұсқа 7: Li,Na,K — қасиет:",opts:["Жұмсақ металлдар,суда еритін гидроксид", "Қатты", "Суда ерімейтін", "Инертті"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r7_q22",q:"Нұсқа 7: Be(OH)₂ қасиеті:",opts:["Амфотерлі", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r7_q23",q:"Нұсқа 7: CO+O₂→ өнімі:",opts:["CO₂", "CO₃", "C+O₂", "COH"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r7_q24",q:"Нұсқа 7: SiO₂+NaOH→",opts:["Na₂SiO₃+H₂O", "SiNaO", "Si+Na₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r7_q25",q:"Нұсқа 7: Аммиак алу (Haber процесі):",opts:["N₂+3H₂→2NH₃ (Fe катализаторы)", "N₂+O₂→NO", "NH₃+O₂→NO", "N₂+H₂O→NH₃"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r7_q26",q:"Нұсқа 7: HNO₃(сұйытылған)+Fe→",opts:["Fe(NO₃)₂+NO+H₂O", "Fe(NO₃)₃+NO₂", "FeNO₃", "Fe+H₂"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r7_q27",q:"Нұсқа 7: SO₃+H₂O→",opts:["H₂SO₄", "H₂SO₃", "H₂S", "SO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r7_q28",q:"Нұсқа 7: H₂S — ертіндісі рН:",opts:["рН<7 (қышқылдық)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r7_q29",q:"Нұсқа 7: Cl₂+2KBr→",opts:["2KCl+Br₂ (Cl>Br белсенділік)", "KClO+KBr", "KBrCl+H₂", "Реакция жоқ"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r7_q30",q:"Нұсқа 7: HF — ерекшелігі:",opts:["Шынымен əрекеттеседі (SiO₂),сutе уытты", "Ең күшті қышқыл", "Тот баспайды", "Ерімейді"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r7_q31",q:"Нұсқа 7: CrO₄²⁻ сары түсті, Cr₂O₇²⁻ — түсі:",opts:["Қызғылт-сары (оранжевый)", "Жасыл", "Көк", "Күлгін"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r7_q32",q:"Нұсқа 7: Кешен тұздың иондану:",opts:["[Cu(NH₃)₄]SO₄→[Cu(NH₃)₄]²⁺+SO₄²⁻", "Тек Cu²⁺ бөлінеді", "Тек SO₄²⁻", "Ыдырамайды"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r7_q33",q:"Нұсқа 7: Алкандар — тізбек ережесі:",opts:["Sp³-гибридтелу,σ-байланыс,стация", "sp²", "sp", "Аралас"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r7_q34",q:"Нұсқа 7: Гомолог деп аталады:",opts:["CH₂ тобынан айырмасы бар бір қатардың мүшелері", "Изомерлер", "Бірдей формула", "Əртүрлі топтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r7_q35",q:"Нұсқа 7: CH₃COOCH₂CH₃ — атауы:",opts:["Этилацетат (этилсірке эфирі)", "Метилацетат", "Этилформиат", "Метилпропионат"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r7_q36",q:"Нұсқа 7: Глюкоза+O₂→ (клетка тыныс алуы):",opts:["6CO₂+6H₂O+38АТФ", "C₂H₅OH+CO₂", "CH₄+H₂O", "CO+H₂O"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r7_q37",q:"Нұсқа 7: Поливинилхлорид (ПВХ) мономері:",opts:["CH₂=CHCl", "CH₂=CH₂", "CHCl₃", "C₂H₄"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r7_q38",q:"Нұсқа 7: Тефлон (ПТФЭ) полимер:",opts:["-(CF₂-CF₂)ₙ- (тфлон,жабысқақ емес)", "-(CH₂)ₙ-", "-(NH-CO)ₙ-", "Нейлон"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r7_q39",q:"Нұсқа 7: 22.4 л (н.ж.) кез-келген газ мольдер саны:",opts:["1 моль", "2 моль", "0.5 моль", "22.4 моль"],ans:0,exp:"Авогадро заңы",topic:"Есеп"},{id:"chem_r7_q40",q:"Нұсқа 7: Зат 92%C, 8%H (M=26). Формуласы:",opts:["C₂H₂ (ацетилен)", "CH₄", "C₂H₄", "C₂H₆"],ans:0,exp:"C:H=92/12:8/1=7.67:8≈1:1, n=2→C₂H₂",topic:"Формула"}]},
{id:"chem_r8",title:"8-нұсқа",questions:[{id:"chem_r8_q1",q:"Нұсқа 8: K атомында электрондар (Z=19):",opts:["19", "18", "20", "39"],ans:0,exp:"",topic:"Атом"},{id:"chem_r8_q2",q:"Нұсқа 8: Изотоп мысалы:",opts:["¹H мен ²H (дейтерий)", "Na мен K", "Fe мен Co", "O мен S"],ans:0,exp:"",topic:"Атом"},{id:"chem_r8_q3",q:"Нұсқа 8: σ-байланыс саны CH₃-CH₃ (этан):",opts:["7", "6", "8", "5"],ans:0,exp:"3+3+1=7",topic:"Байланыс"},{id:"chem_r8_q4",q:"Нұсқа 8: Водородтық байланыс — қатысады:",opts:["H-F, H-O, H-N", "H-Cl", "H-S", "H-C"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r8_q5",q:"Нұсқа 8: IV период 1-ші элемент:",opts:["K (калий)", "Ca", "Sc", "Ar"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r8_q6",q:"Нұсқа 8: Ең кіші атом радиусы бір периодта:",opts:["Жоғары заряды (инертті газ емес)", "Сілтілік металл", "Ауыспалы", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r8_q7",q:"Нұсқа 8: 2Fe+3Cl₂→2FeCl₃. Fe тотығу дәрежесі:",opts:["Fe: 0→+3", "Fe: 0→+2", "Cl: 0→-1 (тотықсыздану)", "Fe: +2→+3"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r8_q8",q:"Нұсқа 8: Тотықтырғыш — ол:",opts:["Электрон алады", "Электрон береді", "Протон береді", "Нейтроны бар"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r8_q9",q:"Нұсқа 8: H₂SO₄(сұйытылған) электролизінде анодта:",opts:["O₂↑", "H₂↑", "SO₃", "H₂SO₄"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r8_q10",q:"Нұсқа 8: Электролиз — Cu алу:",opts:["CuSO₄ ерітіндісін электролиздеу", "Балқытудан", "Термодинамика", "Кинетика"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r8_q11",q:"Нұсқа 8: Тепе-теңдік константасы K — температура артса эндотермиялық реакция:",opts:["K артады", "K кемиді", "K өзгермейді", "K=0"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r8_q12",q:"Нұсқа 8: Гомогендік тепе-теңдікте:",opts:["Барлығы бір фазада", "Əртүрлі фазада", "Тек газ", "Тек сұйық"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r8_q13",q:"Нұсқа 8: Реакция жылдамдығы теңдеуі:",opts:["v=k[A]ᵐ[B]ⁿ", "v=k[A]+[B]", "v=k", "v=k/[A]"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r8_q14",q:"Нұсқа 8: Температуралық коэффициент γ=2 болса, Т 30°C артса жылдамдық:",opts:["8 есе артады (2³)", "2 есе", "4 есе", "27 есе"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r8_q15",q:"Нұсқа 8: рН=7 ерітіндіде [OH⁻]:",opts:["10⁻⁷ моль/л", "10⁻¹⁴ моль/л", "1 моль/л", "7 моль/л"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r8_q16",q:"Нұсқа 8: Индикатор фенолфталеин сілтілік ортада:",opts:["Қызыл-күлгін", "Түссіз", "Сары", "Көк"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r8_q17",q:"Нұсқа 8: AlCl₃ гидролизінен ерітінді ортасы:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r8_q18",q:"Нұсқа 8: Гидролизді жылдамдататын жағдай:",opts:["Температура артса", "Температура азайса", "рН=7", "Концентрация азайса"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r8_q19",q:"Нұсқа 8: Металлдар ішінде ең жоғары өткізгіш:",opts:["Ag (күміс)", "Cu", "Au", "Al"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r8_q20",q:"Нұсқа 8: Fe+CuSO₄→ реакция мүмкін бе:",opts:["Иə (Fe>Cu белсенділік)", "Жоқ", "Тек конц.", "Тек t°"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r8_q21",q:"Нұсқа 8: Li,Na,K — қасиет:",opts:["Жұмсақ металлдар,суда еритін гидроксид", "Қатты", "Суда ерімейтін", "Инертті"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r8_q22",q:"Нұсқа 8: Be(OH)₂ қасиеті:",opts:["Амфотерлі", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r8_q23",q:"Нұсқа 8: CO+O₂→ өнімі:",opts:["CO₂", "CO₃", "C+O₂", "COH"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r8_q24",q:"Нұсқа 8: SiO₂+NaOH→",opts:["Na₂SiO₃+H₂O", "SiNaO", "Si+Na₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r8_q25",q:"Нұсқа 8: Аммиак алу (Haber процесі):",opts:["N₂+3H₂→2NH₃ (Fe катализаторы)", "N₂+O₂→NO", "NH₃+O₂→NO", "N₂+H₂O→NH₃"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r8_q26",q:"Нұсқа 8: HNO₃(сұйытылған)+Fe→",opts:["Fe(NO₃)₂+NO+H₂O", "Fe(NO₃)₃+NO₂", "FeNO₃", "Fe+H₂"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r8_q27",q:"Нұсқа 8: SO₃+H₂O→",opts:["H₂SO₄", "H₂SO₃", "H₂S", "SO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r8_q28",q:"Нұсқа 8: H₂S — ертіндісі рН:",opts:["рН<7 (қышқылдық)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r8_q29",q:"Нұсқа 8: Cl₂+2KBr→",opts:["2KCl+Br₂ (Cl>Br белсенділік)", "KClO+KBr", "KBrCl+H₂", "Реакция жоқ"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r8_q30",q:"Нұсқа 8: HF — ерекшелігі:",opts:["Шынымен əрекеттеседі (SiO₂),сutе уытты", "Ең күшті қышқыл", "Тот баспайды", "Ерімейді"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r8_q31",q:"Нұсқа 8: CrO₄²⁻ сары түсті, Cr₂O₇²⁻ — түсі:",opts:["Қызғылт-сары (оранжевый)", "Жасыл", "Көк", "Күлгін"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r8_q32",q:"Нұсқа 8: Кешен тұздың иондану:",opts:["[Cu(NH₃)₄]SO₄→[Cu(NH₃)₄]²⁺+SO₄²⁻", "Тек Cu²⁺ бөлінеді", "Тек SO₄²⁻", "Ыдырамайды"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r8_q33",q:"Нұсқа 8: Алкандар — тізбек ережесі:",opts:["Sp³-гибридтелу,σ-байланыс,стация", "sp²", "sp", "Аралас"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r8_q34",q:"Нұсқа 8: Гомолог деп аталады:",opts:["CH₂ тобынан айырмасы бар бір қатардың мүшелері", "Изомерлер", "Бірдей формула", "Əртүрлі топтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r8_q35",q:"Нұсқа 8: CH₃COOCH₂CH₃ — атауы:",opts:["Этилацетат (этилсірке эфирі)", "Метилацетат", "Этилформиат", "Метилпропионат"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r8_q36",q:"Нұсқа 8: Глюкоза+O₂→ (клетка тыныс алуы):",opts:["6CO₂+6H₂O+38АТФ", "C₂H₅OH+CO₂", "CH₄+H₂O", "CO+H₂O"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r8_q37",q:"Нұсқа 8: Поливинилхлорид (ПВХ) мономері:",opts:["CH₂=CHCl", "CH₂=CH₂", "CHCl₃", "C₂H₄"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r8_q38",q:"Нұсқа 8: Тефлон (ПТФЭ) полимер:",opts:["-(CF₂-CF₂)ₙ- (тфлон,жабысқақ емес)", "-(CH₂)ₙ-", "-(NH-CO)ₙ-", "Нейлон"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r8_q39",q:"Нұсқа 8: 22.4 л (н.ж.) кез-келген газ мольдер саны:",opts:["1 моль", "2 моль", "0.5 моль", "22.4 моль"],ans:0,exp:"Авогадро заңы",topic:"Есеп"},{id:"chem_r8_q40",q:"Нұсқа 8: Зат 92%C, 8%H (M=26). Формуласы:",opts:["C₂H₂ (ацетилен)", "CH₄", "C₂H₄", "C₂H₆"],ans:0,exp:"C:H=92/12:8/1=7.67:8≈1:1, n=2→C₂H₂",topic:"Формула"}]},
{id:"chem_r9",title:"9-нұсқа",questions:[{id:"chem_r9_q1",q:"Нұсқа 9: K атомында электрондар (Z=19):",opts:["19", "18", "20", "39"],ans:0,exp:"",topic:"Атом"},{id:"chem_r9_q2",q:"Нұсқа 9: Изотоп мысалы:",opts:["¹H мен ²H (дейтерий)", "Na мен K", "Fe мен Co", "O мен S"],ans:0,exp:"",topic:"Атом"},{id:"chem_r9_q3",q:"Нұсқа 9: σ-байланыс саны CH₃-CH₃ (этан):",opts:["7", "6", "8", "5"],ans:0,exp:"3+3+1=7",topic:"Байланыс"},{id:"chem_r9_q4",q:"Нұсқа 9: Водородтық байланыс — қатысады:",opts:["H-F, H-O, H-N", "H-Cl", "H-S", "H-C"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r9_q5",q:"Нұсқа 9: IV период 1-ші элемент:",opts:["K (калий)", "Ca", "Sc", "Ar"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r9_q6",q:"Нұсқа 9: Ең кіші атом радиусы бір периодта:",opts:["Жоғары заряды (инертті газ емес)", "Сілтілік металл", "Ауыспалы", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r9_q7",q:"Нұсқа 9: 2Fe+3Cl₂→2FeCl₃. Fe тотығу дәрежесі:",opts:["Fe: 0→+3", "Fe: 0→+2", "Cl: 0→-1 (тотықсыздану)", "Fe: +2→+3"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r9_q8",q:"Нұсқа 9: Тотықтырғыш — ол:",opts:["Электрон алады", "Электрон береді", "Протон береді", "Нейтроны бар"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r9_q9",q:"Нұсқа 9: H₂SO₄(сұйытылған) электролизінде анодта:",opts:["O₂↑", "H₂↑", "SO₃", "H₂SO₄"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r9_q10",q:"Нұсқа 9: Электролиз — Cu алу:",opts:["CuSO₄ ерітіндісін электролиздеу", "Балқытудан", "Термодинамика", "Кинетика"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r9_q11",q:"Нұсқа 9: Тепе-теңдік константасы K — температура артса эндотермиялық реакция:",opts:["K артады", "K кемиді", "K өзгермейді", "K=0"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r9_q12",q:"Нұсқа 9: Гомогендік тепе-теңдікте:",opts:["Барлығы бір фазада", "Əртүрлі фазада", "Тек газ", "Тек сұйық"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r9_q13",q:"Нұсқа 9: Реакция жылдамдығы теңдеуі:",opts:["v=k[A]ᵐ[B]ⁿ", "v=k[A]+[B]", "v=k", "v=k/[A]"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r9_q14",q:"Нұсқа 9: Температуралық коэффициент γ=2 болса, Т 30°C артса жылдамдық:",opts:["8 есе артады (2³)", "2 есе", "4 есе", "27 есе"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r9_q15",q:"Нұсқа 9: рН=7 ерітіндіде [OH⁻]:",opts:["10⁻⁷ моль/л", "10⁻¹⁴ моль/л", "1 моль/л", "7 моль/л"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r9_q16",q:"Нұсқа 9: Индикатор фенолфталеин сілтілік ортада:",opts:["Қызыл-күлгін", "Түссіз", "Сары", "Көк"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r9_q17",q:"Нұсқа 9: AlCl₃ гидролизінен ерітінді ортасы:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r9_q18",q:"Нұсқа 9: Гидролизді жылдамдататын жағдай:",opts:["Температура артса", "Температура азайса", "рН=7", "Концентрация азайса"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r9_q19",q:"Нұсқа 9: Металлдар ішінде ең жоғары өткізгіш:",opts:["Ag (күміс)", "Cu", "Au", "Al"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r9_q20",q:"Нұсқа 9: Fe+CuSO₄→ реакция мүмкін бе:",opts:["Иə (Fe>Cu белсенділік)", "Жоқ", "Тек конц.", "Тек t°"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r9_q21",q:"Нұсқа 9: Li,Na,K — қасиет:",opts:["Жұмсақ металлдар,суда еритін гидроксид", "Қатты", "Суда ерімейтін", "Инертті"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r9_q22",q:"Нұсқа 9: Be(OH)₂ қасиеті:",opts:["Амфотерлі", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r9_q23",q:"Нұсқа 9: CO+O₂→ өнімі:",opts:["CO₂", "CO₃", "C+O₂", "COH"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r9_q24",q:"Нұсқа 9: SiO₂+NaOH→",opts:["Na₂SiO₃+H₂O", "SiNaO", "Si+Na₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r9_q25",q:"Нұсқа 9: Аммиак алу (Haber процесі):",opts:["N₂+3H₂→2NH₃ (Fe катализаторы)", "N₂+O₂→NO", "NH₃+O₂→NO", "N₂+H₂O→NH₃"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r9_q26",q:"Нұсқа 9: HNO₃(сұйытылған)+Fe→",opts:["Fe(NO₃)₂+NO+H₂O", "Fe(NO₃)₃+NO₂", "FeNO₃", "Fe+H₂"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r9_q27",q:"Нұсқа 9: SO₃+H₂O→",opts:["H₂SO₄", "H₂SO₃", "H₂S", "SO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r9_q28",q:"Нұсқа 9: H₂S — ертіндісі рН:",opts:["рН<7 (қышқылдық)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r9_q29",q:"Нұсқа 9: Cl₂+2KBr→",opts:["2KCl+Br₂ (Cl>Br белсенділік)", "KClO+KBr", "KBrCl+H₂", "Реакция жоқ"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r9_q30",q:"Нұсқа 9: HF — ерекшелігі:",opts:["Шынымен əрекеттеседі (SiO₂),сutе уытты", "Ең күшті қышқыл", "Тот баспайды", "Ерімейді"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r9_q31",q:"Нұсқа 9: CrO₄²⁻ сары түсті, Cr₂O₇²⁻ — түсі:",opts:["Қызғылт-сары (оранжевый)", "Жасыл", "Көк", "Күлгін"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r9_q32",q:"Нұсқа 9: Кешен тұздың иондану:",opts:["[Cu(NH₃)₄]SO₄→[Cu(NH₃)₄]²⁺+SO₄²⁻", "Тек Cu²⁺ бөлінеді", "Тек SO₄²⁻", "Ыдырамайды"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r9_q33",q:"Нұсқа 9: Алкандар — тізбек ережесі:",opts:["Sp³-гибридтелу,σ-байланыс,стация", "sp²", "sp", "Аралас"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r9_q34",q:"Нұсқа 9: Гомолог деп аталады:",opts:["CH₂ тобынан айырмасы бар бір қатардың мүшелері", "Изомерлер", "Бірдей формула", "Əртүрлі топтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r9_q35",q:"Нұсқа 9: CH₃COOCH₂CH₃ — атауы:",opts:["Этилацетат (этилсірке эфирі)", "Метилацетат", "Этилформиат", "Метилпропионат"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r9_q36",q:"Нұсқа 9: Глюкоза+O₂→ (клетка тыныс алуы):",opts:["6CO₂+6H₂O+38АТФ", "C₂H₅OH+CO₂", "CH₄+H₂O", "CO+H₂O"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r9_q37",q:"Нұсқа 9: Поливинилхлорид (ПВХ) мономері:",opts:["CH₂=CHCl", "CH₂=CH₂", "CHCl₃", "C₂H₄"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r9_q38",q:"Нұсқа 9: Тефлон (ПТФЭ) полимер:",opts:["-(CF₂-CF₂)ₙ- (тфлон,жабысқақ емес)", "-(CH₂)ₙ-", "-(NH-CO)ₙ-", "Нейлон"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r9_q39",q:"Нұсқа 9: 22.4 л (н.ж.) кез-келген газ мольдер саны:",opts:["1 моль", "2 моль", "0.5 моль", "22.4 моль"],ans:0,exp:"Авогадро заңы",topic:"Есеп"},{id:"chem_r9_q40",q:"Нұсқа 9: Зат 92%C, 8%H (M=26). Формуласы:",opts:["C₂H₂ (ацетилен)", "CH₄", "C₂H₄", "C₂H₆"],ans:0,exp:"C:H=92/12:8/1=7.67:8≈1:1, n=2→C₂H₂",topic:"Формула"}]},
{id:"chem_r10",title:"10-нұсқа",questions:[{id:"chem_r10_q1",q:"Нұсқа 10: K атомында электрондар (Z=19):",opts:["19", "18", "20", "39"],ans:0,exp:"",topic:"Атом"},{id:"chem_r10_q2",q:"Нұсқа 10: Изотоп мысалы:",opts:["¹H мен ²H (дейтерий)", "Na мен K", "Fe мен Co", "O мен S"],ans:0,exp:"",topic:"Атом"},{id:"chem_r10_q3",q:"Нұсқа 10: σ-байланыс саны CH₃-CH₃ (этан):",opts:["7", "6", "8", "5"],ans:0,exp:"3+3+1=7",topic:"Байланыс"},{id:"chem_r10_q4",q:"Нұсқа 10: Водородтық байланыс — қатысады:",opts:["H-F, H-O, H-N", "H-Cl", "H-S", "H-C"],ans:0,exp:"",topic:"Байланыс"},{id:"chem_r10_q5",q:"Нұсқа 10: IV период 1-ші элемент:",opts:["K (калий)", "Ca", "Sc", "Ar"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r10_q6",q:"Нұсқа 10: Ең кіші атом радиусы бір периодта:",opts:["Жоғары заряды (инертті газ емес)", "Сілтілік металл", "Ауыспалы", "Инертті газ"],ans:0,exp:"",topic:"Периодтық"},{id:"chem_r10_q7",q:"Нұсқа 10: 2Fe+3Cl₂→2FeCl₃. Fe тотығу дәрежесі:",opts:["Fe: 0→+3", "Fe: 0→+2", "Cl: 0→-1 (тотықсыздану)", "Fe: +2→+3"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r10_q8",q:"Нұсқа 10: Тотықтырғыш — ол:",opts:["Электрон алады", "Электрон береді", "Протон береді", "Нейтроны бар"],ans:0,exp:"",topic:"ТТР"},{id:"chem_r10_q9",q:"Нұсқа 10: H₂SO₄(сұйытылған) электролизінде анодта:",opts:["O₂↑", "H₂↑", "SO₃", "H₂SO₄"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r10_q10",q:"Нұсқа 10: Электролиз — Cu алу:",opts:["CuSO₄ ерітіндісін электролиздеу", "Балқытудан", "Термодинамика", "Кинетика"],ans:0,exp:"",topic:"Электролиз"},{id:"chem_r10_q11",q:"Нұсқа 10: Тепе-теңдік константасы K — температура артса эндотермиялық реакция:",opts:["K артады", "K кемиді", "K өзгермейді", "K=0"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r10_q12",q:"Нұсқа 10: Гомогендік тепе-теңдікте:",opts:["Барлығы бір фазада", "Əртүрлі фазада", "Тек газ", "Тек сұйық"],ans:0,exp:"",topic:"Тепе-теңдік"},{id:"chem_r10_q13",q:"Нұсқа 10: Реакция жылдамдығы теңдеуі:",opts:["v=k[A]ᵐ[B]ⁿ", "v=k[A]+[B]", "v=k", "v=k/[A]"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r10_q14",q:"Нұсқа 10: Температуралық коэффициент γ=2 болса, Т 30°C артса жылдамдық:",opts:["8 есе артады (2³)", "2 есе", "4 есе", "27 есе"],ans:0,exp:"",topic:"Кинетика"},{id:"chem_r10_q15",q:"Нұсқа 10: рН=7 ерітіндіде [OH⁻]:",opts:["10⁻⁷ моль/л", "10⁻¹⁴ моль/л", "1 моль/л", "7 моль/л"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r10_q16",q:"Нұсқа 10: Индикатор фенолфталеин сілтілік ортада:",opts:["Қызыл-күлгін", "Түссіз", "Сары", "Көк"],ans:0,exp:"",topic:"Қышқыл-негіз"},{id:"chem_r10_q17",q:"Нұсқа 10: AlCl₃ гидролизінен ерітінді ортасы:",opts:["рН<7 (қышқыл)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r10_q18",q:"Нұсқа 10: Гидролизді жылдамдататын жағдай:",opts:["Температура артса", "Температура азайса", "рН=7", "Концентрация азайса"],ans:0,exp:"",topic:"Гидролиз"},{id:"chem_r10_q19",q:"Нұсқа 10: Металлдар ішінде ең жоғары өткізгіш:",opts:["Ag (күміс)", "Cu", "Au", "Al"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r10_q20",q:"Нұсқа 10: Fe+CuSO₄→ реакция мүмкін бе:",opts:["Иə (Fe>Cu белсенділік)", "Жоқ", "Тек конц.", "Тек t°"],ans:0,exp:"",topic:"Металлдар"},{id:"chem_r10_q21",q:"Нұсқа 10: Li,Na,K — қасиет:",opts:["Жұмсақ металлдар,суда еритін гидроксид", "Қатты", "Суда ерімейтін", "Инертті"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r10_q22",q:"Нұсқа 10: Be(OH)₂ қасиеті:",opts:["Амфотерлі", "Тек негіздік", "Тек қышқылдық", "Бейтарап"],ans:0,exp:"",topic:"I-III топ"},{id:"chem_r10_q23",q:"Нұсқа 10: CO+O₂→ өнімі:",opts:["CO₂", "CO₃", "C+O₂", "COH"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r10_q24",q:"Нұсқа 10: SiO₂+NaOH→",opts:["Na₂SiO₃+H₂O", "SiNaO", "Si+Na₂O", "Реакция жоқ"],ans:0,exp:"",topic:"XIV топ"},{id:"chem_r10_q25",q:"Нұсқа 10: Аммиак алу (Haber процесі):",opts:["N₂+3H₂→2NH₃ (Fe катализаторы)", "N₂+O₂→NO", "NH₃+O₂→NO", "N₂+H₂O→NH₃"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r10_q26",q:"Нұсқа 10: HNO₃(сұйытылған)+Fe→",opts:["Fe(NO₃)₂+NO+H₂O", "Fe(NO₃)₃+NO₂", "FeNO₃", "Fe+H₂"],ans:0,exp:"",topic:"XV топ"},{id:"chem_r10_q27",q:"Нұсқа 10: SO₃+H₂O→",opts:["H₂SO₄", "H₂SO₃", "H₂S", "SO₂"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r10_q28",q:"Нұсқа 10: H₂S — ертіндісі рН:",opts:["рН<7 (қышқылдық)", "рН>7", "рН=7", "рН=14"],ans:0,exp:"",topic:"XVI топ"},{id:"chem_r10_q29",q:"Нұсқа 10: Cl₂+2KBr→",opts:["2KCl+Br₂ (Cl>Br белсенділік)", "KClO+KBr", "KBrCl+H₂", "Реакция жоқ"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r10_q30",q:"Нұсқа 10: HF — ерекшелігі:",opts:["Шынымен əрекеттеседі (SiO₂),сutе уытты", "Ең күшті қышқыл", "Тот баспайды", "Ерімейді"],ans:0,exp:"",topic:"XVII топ"},{id:"chem_r10_q31",q:"Нұсқа 10: CrO₄²⁻ сары түсті, Cr₂O₇²⁻ — түсі:",opts:["Қызғылт-сары (оранжевый)", "Жасыл", "Көк", "Күлгін"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r10_q32",q:"Нұсқа 10: Кешен тұздың иондану:",opts:["[Cu(NH₃)₄]SO₄→[Cu(NH₃)₄]²⁺+SO₄²⁻", "Тек Cu²⁺ бөлінеді", "Тек SO₄²⁻", "Ыдырамайды"],ans:0,exp:"",topic:"Өтпелі/кешен"},{id:"chem_r10_q33",q:"Нұсқа 10: Алкандар — тізбек ережесі:",opts:["Sp³-гибридтелу,σ-байланыс,стация", "sp²", "sp", "Аралас"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r10_q34",q:"Нұсқа 10: Гомолог деп аталады:",opts:["CH₂ тобынан айырмасы бар бір қатардың мүшелері", "Изомерлер", "Бірдей формула", "Əртүрлі топтар"],ans:0,exp:"",topic:"Органикалық жалпы"},{id:"chem_r10_q35",q:"Нұсқа 10: CH₃COOCH₂CH₃ — атауы:",opts:["Этилацетат (этилсірке эфирі)", "Метилацетат", "Этилформиат", "Метилпропионат"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r10_q36",q:"Нұсқа 10: Глюкоза+O₂→ (клетка тыныс алуы):",opts:["6CO₂+6H₂O+38АТФ", "C₂H₅OH+CO₂", "CH₄+H₂O", "CO+H₂O"],ans:0,exp:"",topic:"О-бар органикалық"},{id:"chem_r10_q37",q:"Нұсқа 10: Поливинилхлорид (ПВХ) мономері:",opts:["CH₂=CHCl", "CH₂=CH₂", "CHCl₃", "C₂H₄"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r10_q38",q:"Нұсқа 10: Тефлон (ПТФЭ) полимер:",opts:["-(CF₂-CF₂)ₙ- (тфлон,жабысқақ емес)", "-(CH₂)ₙ-", "-(NH-CO)ₙ-", "Нейлон"],ans:0,exp:"",topic:"Полимерлер"},{id:"chem_r10_q39",q:"Нұсқа 10: 22.4 л (н.ж.) кез-келген газ мольдер саны:",opts:["1 моль", "2 моль", "0.5 моль", "22.4 моль"],ans:0,exp:"Авогадро заңы",topic:"Есеп"},{id:"chem_r10_q40",q:"Нұсқа 10: Зат 92%C, 8%H (M=26). Формуласы:",opts:["C₂H₂ (ацетилен)", "CH₄", "C₂H₄", "C₂H₆"],ans:0,exp:"C:H=92/12:8/1=7.67:8≈1:1, n=2→C₂H₂",topic:"Формула"}]}]};;
const INIT_CONTENT={...{"videos": {}, "pdfs": {}, "testCounts": {"chemistry": 10}, "writingTasks": {}, "lessonErrorWork": {}, "lessonPdfs": {}, "hwTestCount": {}, "fixTestCount": {}, "errorWork": {}, "unlockedLessons": {}, "promoCodes": {}, "activationCodes": {}, "announcements": [{"id": 1, "title": "Қош келдіңіз!", "body": "Химия курсы: 31 тарау, 224 тақырып, әр тарауға 40 тапсырмалық қорытынды тест. Алғашқы сабақтар тегін.", "type": "info", "date": "2026-11-08", "author": "Admin", "pinned": true}], "homework": []},variants:INIT_VARIANTS,lessonTests:{},hwTests:{},questions:QUESTIONS,topics:TOPICS};

/* ════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════ */
/* ════ TOP-LEVEL SUB-COMPONENTS ════ */

/* ════════════════════════════════════════════════════════
   ADMIN CONTENT MANAGEMENT — Screenshot-style
   Views: subjectGrid → topicGrid → lessonModal
════════════════════════════════════════════════════════ */
// ── Жүктелген файлдан (docx/md/txt) теория мен тест сұрақтарын автоматты бөліп алу ──
// Python құбырымен бірдей логика: § бөлімдер = теория, БӨЛІМ 1-4 = тест сұрақтары
const parseUploadedChapterDoc=(rawText)=>{
  let text=rawText.replace(/\r\n/g,"\n");
  const SUB={"0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉","+":"₊","-":"₋"};
  const SUP={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻"};
  const toSub=s=>s.split("").map(c=>SUB[c]||c).join("");
  const toSup=s=>s.split("").map(c=>SUP[c]||c).join("");
  const cleanFormulas=t=>t
    .replace(/\$([^$]+)\$/g,(m,inner)=>{
      let s=inner;
      s=s.replace(/_\{([^{}]*)\}/g,(mm,g)=>toSub(g));
      s=s.replace(/\^\{([^{}]*)\}/g,(mm,g)=>toSup(g));
      s=s.replace(/_([0-9+-])/g,(mm,g)=>toSub(g));
      s=s.replace(/\^([0-9+-])/g,(mm,g)=>toSup(g));
      return s.replace(/\\[a-zA-Z]+/g,"");
    });
  const clean=(t,unwrap=true)=>{
    t=cleanFormulas(t);
    t=t.replace(/\\\)/g,")").replace(/\\\(/g,"(");
    t=t.replace(/---/g,"—").replace(/--/g,"–");
    if(unwrap){
      t=t.replace(/\n[ \t]{2,}/g," ");
      t=t.replace(/[ \t]+\n/g,"\n");
      t=t.replace(/\n{3,}/g,"\n\n");
    }
    return t.trim();
  };
  const cleanInline=t=>clean(t).replace(/\s+/g," ").trim();

  // Extract video/PDF link if the doc literally contains one
  const urlM=text.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|drive\.google\.com)[^\s)\]]+/i);
  const pdfM=text.match(/https?:\/\/(?:www\.)?drive\.google\.com\/[^\s)\]]*\/(?:view|d\/)[^\s)\]]*|https?:\/\/[^\s)\]]+\.pdf/i);

  // Theory = everything before the first "### БӨЛІМ" / "## ҰБТ ТАРАУ ТЕСТІ" / "## ЖАУАП" marker,
  // with any "## §N. ..." headers stripped out (keeps just the body prose+tables+lists)
  const cutIdx=(()=>{
    const m=text.search(/\n##\s*(ҰБТ ТАРАУ ТЕСТІ|ТАРАУ ҚОРЫТЫНДЫСЫ|ЖАУАП КІЛТІ)/);
    return m>=0?m:text.length;
  })();
  let theoryRaw=text.slice(0,cutIdx);
  theoryRaw=theoryRaw.replace(/^##\s+.*$/gm,"").replace(/^###\s+Тапсырмалар.*$/gm,"");
  const theory=clean(theoryRaw);

  const questions=[];
  const getAnswerKey=()=>{
    const m=text.match(/## ЖАУАП КІЛТІ\n([\s\S]*?)(?:\n##\s|$)/);
    if(!m)return{};
    const out={};
    m[1].split("\n").forEach(line=>{
      line=line.trim();
      if(!line.startsWith("|"))return;
      const cells=line.replace(/^\||\|$/g,"").split("|").map(c=>c.trim());
      if(cells.length<2)return;
      if(!/^\d+$/.test(cells[0]))return;
      out[parseInt(cells[0])]=cells[1];
    });
    return out;
  };
  const ansKey=getAnswerKey();

  const parseQaBlock=(body)=>{
    const lines=body.split("\n").filter(l=>l.trim());
    const stemLines=[]; const opts={}; let curOpt=null;
    lines.forEach(l=>{
      const m=l.trim().match(/^([A-E])\)\s*(.*)/);
      if(m){curOpt=m[1];opts[curOpt]=m[2].trim();}
      else if(curOpt){opts[curOpt]+=" "+l.trim();}
      else{stemLines.push(l.trim());}
    });
    const stem=cleanInline(stemLines.join(" "));
    const ordered=["A","B","C","D","E"].filter(l=>opts[l]).map(l=>cleanInline(opts[l]));
    return {stem,opts:ordered};
  };
  const splitNumbered=(blockText)=>{
    const out={};
    const parts=blockText.split(/\*\*(\d+)\.\*\*\s*/);
    for(let i=1;i<parts.length;i+=2)out[parseInt(parts[i])]=parts[i+1];
    return out;
  };
  const section=(label,nextLabel)=>{
    const re=new RegExp("###\\s*"+label+"[\\s\\S]*?\\n([\\s\\S]*?)\\n##\\s*"+nextLabel);
    const m=text.match(re);
    return m?m[1]:null;
  };

  // БӨЛІМ 1: single-answer
  let b1=text.match(/###\s*БӨЛІМ 1[\s\S]*?\n([\s\S]*?)\n###\s*БӨЛІМ 2/);
  if(b1){
    const map=splitNumbered(b1[1]);
    Object.keys(map).forEach(numStr=>{
      const num=parseInt(numStr);
      const {stem,opts}=parseQaBlock(map[num]);
      if(opts.length<2)return;
      const letter=(ansKey[num]||"A").trim();
      const idx="ABCDE".indexOf(letter[0]);
      questions.push({id:"up_q"+num+"_"+Date.now(),q:stem,opts,ans:idx>=0?idx:0,exp:"Дұрыс жауап: "+letter});
    });
  }
  // БӨЛІМ 2: multi-answer
  let b2=text.match(/###\s*БӨЛІМ 2[\s\S]*?\n([\s\S]*?)\n###\s*БӨЛІМ 3/);
  if(b2){
    const map=splitNumbered(b2[1]);
    Object.keys(map).forEach(numStr=>{
      const num=parseInt(numStr);
      const {stem,opts}=parseQaBlock(map[num]);
      if(opts.length<2)return;
      const letters=(ansKey[num]||"A").split(/[,\s]+/).filter(l=>l&&"ABCDE".includes(l));
      const idxs=letters.map(l=>"ABCDE".indexOf(l)).sort();
      questions.push({id:"up_q"+num+"_"+Date.now(),q:stem,opts,multi:true,ans_all:idxs,exp:"Дұрыс жауаптар: "+(ansKey[num]||"")});
    });
  }
  // БӨЛІМ 3: context (single-answer, share a context paragraph)
  let b3=text.match(/###\s*БӨЛІМ 3[\s\S]*?\n([\s\S]*?)\n###\s*БӨЛІМ 4/);
  if(b3){
    const ctxM=b3[1].match(/\*\*Контекст:\*\*\s*([\s\S]*?)\n\n/);
    const ctxStr=ctxM?cleanInline(ctxM[1]):"";
    const map=splitNumbered(b3[1]);
    let first=true;
    Object.keys(map).forEach(numStr=>{
      const num=parseInt(numStr);
      let {stem,opts}=parseQaBlock(map[num]);
      if(opts.length<2)return;
      if(first&&ctxStr){stem="[Контекст: "+ctxStr+"]\n\n"+stem;first=false;}
      const letter=(ansKey[num]||"A").trim();
      const idx="ABCDE".indexOf(letter[0]);
      questions.push({id:"up_q"+num+"_"+Date.now(),q:stem,opts,ans:idx>=0?idx:0,exp:"Дұрыс жауап: "+letter});
    });
  }
  // БӨЛІМ 4: matching
  let b4=text.match(/###\s*БӨЛІМ 4[\s\S]*?\n([\s\S]*?)\n##\s*ЖАУАП/);
  if(b4){
    const parts=b4[1].split(/\*\*(\d+)\.\*\*\s*/);
    const bodies={};
    for(let i=1;i<parts.length;i+=2)bodies[parseInt(parts[i])]=parts[i+1];
    Object.keys(bodies).forEach(numStr=>{
      const num=parseInt(numStr);
      const body=bodies[num];
      const stemLine=cleanInline(body.split("\n")[0]);
      const rows=body.split("\n").map(l=>l.trim()).filter(l=>l.startsWith("|"));
      const dataRows=rows.filter(l=>!/^\|[\s:|-]+\|$/.test(l)).slice(1);
      const lefts=[]; const rightsByLetter={};
      dataRows.forEach(r=>{
        const cells=r.replace(/^\||\|$/g,"").split("|").map(c=>c.trim());
        if(cells.length<3||!/^\d+$/.test(cells[0]))return;
        lefts.push(cleanInline(cells[1]));
        const rm=cells[2].match(/^([A-E])\)\s*(.*)/);
        if(rm)rightsByLetter[rm[1]]=cleanInline(rm[2]);
      });
      const ansStr=ansKey[num]||"";
      const pairsAns={};
      ansStr.split(/[,;]\s*/).forEach(part=>{
        const mm=part.trim().match(/(\d+)\s*-\s*([A-E])/);
        if(mm)pairsAns[parseInt(mm[1])]=mm[2];
      });
      const pairs=lefts.map((left,i)=>({left,right:rightsByLetter[pairsAns[i+1]]||""}));
      questions.push({id:"up_q"+num+"_"+Date.now(),q:stemLine,type:"match",pairs,exp:"Сәйкестік: "+ansStr});
    });
  }

  return {theory,questions,videoUrl:urlM?urlM[0]:"",pdfUrl:pdfM?pdfM[0]:""};
};

// ── ОЙЫН 1: Флэш-карттар (сұрақ/жауап аударылатын карточкалар) ──
function FlashcardsGame({questions,onDone,C}){
  const [i,setI]=useState(0);
  const [flipped,setFlipped]=useState(false);
  const [known,setKnown]=useState({});
  if(!questions.length)return null;
  const q=questions[i];
  const answerText=q.type==="match"?(q.pairs||[]).map(p=>`${p.left} → ${p.right}`).join("; "):q.multi?(q.ans_all||[]).map(idx=>q.opts?.[idx]).join(", "):q.opts?.[q.ans];
  const next=(k)=>{
    setKnown(p=>({...p,[q.id]:k}));
    setFlipped(false);
    if(i<questions.length-1)setI(i+1); else onDone?.(known);
  };
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:12,color:"#9CA3AF",fontWeight:700}}>{i+1} / {questions.length}</span>
        <span style={{fontSize:12,color:"#22C55E",fontWeight:700}}>✅ {Object.values(known).filter(v=>v).length}</span>
      </div>
      <div onClick={()=>setFlipped(f=>!f)} style={{cursor:"pointer",minHeight:180,borderRadius:20,padding:24,
        background:flipped?"linear-gradient(135deg,#F0FFF4,#DCFCE7)":"linear-gradient(135deg,#EEF2FF,#E0E7FF)",
        border:`2px solid ${flipped?"#86EFAC":"#C7D2FE"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <div style={{fontSize:11,fontWeight:800,color:flipped?"#22C55E":"#4F46E5",marginBottom:10,letterSpacing:1}}>{flipped?"ЖАУАБЫ":"СҰРАҚ"}</div>
        <div style={{fontWeight:700,fontSize:16,color:"#1E1B4B",lineHeight:1.5}}>{flipped?answerText:q.q}</div>
        <div style={{fontSize:11,color:"#9CA3AF",marginTop:14}}>{flipped?"":"👆 Жауапты көру үшін басыңыз"}</div>
      </div>
      {flipped&&(
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <button style={{...C.btn,flex:1,padding:"12px 0",background:"#FEE2E2",color:"#DC2626",fontWeight:800}} onClick={()=>next(false)}>😕 Білмедім</button>
          <button style={{...C.btn,flex:1,padding:"12px 0",background:"#DCFCE7",color:"#16A34A",fontWeight:800}} onClick={()=>next(true)}>😊 Білдім</button>
        </div>
      )}
    </div>
  );
}

// ── ОЙЫН 2: Сәйкестендіру (сұрақ пен дұрыс жауапты жұптау) ──
function MatchingCardGame({questions,onDone}){
  const pool=React.useMemo(()=>{
    const usable=questions.filter(q=>q.type!=="match").slice(0,6);
    return usable.map(q=>({
      id:q.id,left:q.q,
      right:q.multi?(q.ans_all||[]).map(idx=>q.opts?.[idx]).join(", "):q.opts?.[q.ans],
    }));
  },[questions]);
  const [rightOrder]=useState(()=>seededShuffle(pool.map((_,i)=>i),"matchgame"));
  const [selLeft,setSelLeft]=useState(null);
  const [matched,setMatched]=useState({});
  const [wrong,setWrong]=useState(null);
  if(!pool.length)return <div style={{color:"#9CA3AF",fontSize:13}}>Бұл ойын үшін сұрақ жеткіліксіз (кемінде 2 керек).</div>;
  const allDone=Object.keys(matched).length===pool.length;
  const clickRight=(ri)=>{
    if(selLeft===null||matched[selLeft]!==undefined)return;
    if(pool[selLeft].id===pool[ri].id){
      const nm={...matched,[selLeft]:ri};
      setMatched(nm);setSelLeft(null);
      if(Object.keys(nm).length===pool.length)onDone?.();
    }else{
      setWrong(ri);setTimeout(()=>setWrong(null),500);
    }
  };
  return(
    <div>
      <div style={{fontSize:12,color:"#9CA3AF",marginBottom:10}}>Сол жақтан сұрақты, содан кейін оң жақтан дұрыс жауапты басыңыз.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          {pool.map((p,li)=>(
            <div key={li} onClick={()=>matched[li]===undefined&&setSelLeft(li)}
              style={{padding:"10px 12px",borderRadius:12,marginBottom:8,fontSize:13,fontWeight:600,cursor:matched[li]!==undefined?"default":"pointer",
                background:matched[li]!==undefined?"#DCFCE7":selLeft===li?"#E0E7FF":"#F9FAFE",
                border:`2px solid ${matched[li]!==undefined?"#86EFAC":selLeft===li?"#818CF8":"#EEF0FF"}`,opacity:matched[li]!==undefined?0.6:1}}>
              {p.left}{matched[li]!==undefined&&" ✓"}
            </div>
          ))}
        </div>
        <div>
          {rightOrder.map((ri,pos)=>{
            const isMatchedAlready=Object.values(matched).includes(ri);
            return(
              <div key={pos} onClick={()=>!isMatchedAlready&&clickRight(ri)}
                style={{padding:"10px 12px",borderRadius:12,marginBottom:8,fontSize:13,fontWeight:600,cursor:isMatchedAlready?"default":"pointer",
                  background:isMatchedAlready?"#DCFCE7":wrong===ri?"#FEE2E2":"#F9FAFE",
                  border:`2px solid ${isMatchedAlready?"#86EFAC":wrong===ri?"#FCA5A5":"#EEF0FF"}`,opacity:isMatchedAlready?0.6:1}}>
                {pool[ri].right}{isMatchedAlready&&" ✓"}
              </div>
            );
          })}
        </div>
      </div>
      {allDone&&<div style={{textAlign:"center",marginTop:14,fontWeight:800,color:"#22C55E",fontSize:15}}>🎉 Бәрі дұрыс сәйкестендірілді!</div>}
    </div>
  );
}

// ── ОЙЫН 3: Дұрыс/Бұрыс (тұжырым дұрыс па, бұрыс па?) ──
function TrueFalseGame({questions,onDone,C}){
  const items=React.useMemo(()=>{
    const usable=questions.filter(q=>q.opts&&q.opts.length>=2);
    return usable.map((q,i)=>{
      const showCorrect=seededShuffle([0,1],q.id+"tf")[0]===0;
      const wrongIdx=q.opts.findIndex((_,oi)=>oi!==(q.ans??0));
      const shownOpt=showCorrect?q.opts[q.ans??0]:q.opts[wrongIdx>=0?wrongIdx:0];
      return{id:q.id,stem:q.q,statement:shownOpt,isTrue:showCorrect,exp:q.exp};
    });
  },[questions]);
  const [i,setI]=useState(0);
  const [score,setScore]=useState(0);
  const [answered,setAnswered]=useState(null);
  if(!items.length)return null;
  if(i>=items.length)return(
    <div style={{textAlign:"center",padding:20}}>
      <div style={{fontSize:40}}>🏁</div>
      <div style={{fontWeight:900,fontSize:24,color:"#4F46E5"}}>{score}/{items.length}</div>
      <button style={{...C.btn,...C.pri,marginTop:14}} onClick={()=>{setI(0);setScore(0);setAnswered(null);onDone?.();}}>Аяқтау</button>
    </div>
  );
  const cur=items[i];
  const pick=(guess)=>{
    if(answered!==null)return;
    const correct=guess===cur.isTrue;
    setAnswered({guess,correct});
    if(correct)setScore(s=>s+1);
  };
  return(
    <div>
      <div style={{fontSize:12,color:"#9CA3AF",marginBottom:10,fontWeight:700}}>{i+1} / {items.length} • ✅ {score}</div>
      <div style={{...C.card,padding:20,marginBottom:14,textAlign:"center"}}>
        <div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>{cur.stem}</div>
        <div style={{fontWeight:800,fontSize:16,color:"#1E1B4B"}}>«{cur.statement}»</div>
      </div>
      {answered===null?(
        <div style={{display:"flex",gap:10}}>
          <button style={{...C.btn,flex:1,padding:"14px 0",background:"#DCFCE7",color:"#16A34A",fontWeight:800,fontSize:15}} onClick={()=>pick(true)}>✅ Дұрыс</button>
          <button style={{...C.btn,flex:1,padding:"14px 0",background:"#FEE2E2",color:"#DC2626",fontWeight:800,fontSize:15}} onClick={()=>pick(false)}>❌ Бұрыс</button>
        </div>
      ):(
        <div>
          <div style={{textAlign:"center",fontWeight:800,color:answered.correct?"#22C55E":"#EF4444",marginBottom:8}}>
            {answered.correct?"✅ Дұрыс тапты!":"❌ Қате"} {!answered.correct&&`— шын мәнінде ${cur.isTrue?"ДҰРЫС":"БҰРЫС"}`}
          </div>
          <button style={{...C.btn,...C.pri,width:"100%",padding:"12px 0"}} onClick={()=>{setI(p=>p+1);setAnswered(null);}}>Келесі →</button>
        </div>
      )}
    </div>
  );
}

function LessonModal({modal,setModal,selSub,content,setContent,showToast}){
  if(!modal)return null;
  const GI={...GC};
  const inp={...GC.input,fontSize:13,marginBottom:0};
  const isNew=!!modal.isNew;
  const [form,setForm]=useState(()=>{
    if(isNew)return{title:"",duration:"15 мин",videoUrl:"",pdfUrl:"",description:"",isFree:false,
      bekituQs:content.lessonTests?.[""||""]||[],
      hwQs:content.hwTests?.[""||""]||[],
      errorVideoUrl:"",errorPdfUrl:""};
    const l=modal.lesson;
    return{...l,
      bekituQs:content.lessonTests?.[l.id]||[],
      hwQs:content.hwTests?.[l.id]||[],
      errorVideoUrl:content.lessonErrorWork?.[l.id]?.videoUrl||"",
      errorPdfUrl:content.lessonErrorWork?.[l.id]?.pdfUrl||"",
    };
  });
  const [newBekitu,setNewBekitu]=useState({q:"",opts:["","","",""],ans:0,exp:""});
  const [newHw,setNewHw]=useState({q:"",opts:["","","",""],ans:0,exp:""});
  const [qTab,setQTab]=useState("bekitu");
  const [parsing,setParsing]=useState(false);

  const addQ=(type)=>{
    const src=type==="bekitu"?newBekitu:newHw;
    if(!src.q.trim()||src.opts.some(o=>!o.trim()))return showToast("Барлық өрісті толтырыңыз","err");
    const nq={id:Date.now(),...src};
    if(type==="bekitu"){setForm(p=>({...p,bekituQs:[...(p.bekituQs||[]),nq]}));setNewBekitu({q:"",opts:["","","",""],ans:0,exp:""});}
    else{setForm(p=>({...p,hwQs:[...(p.hwQs||[]),nq]}));setNewHw({q:"",opts:["","","",""],ans:0,exp:""});}
    showToast("Сұрақ қосылды ✅");
  };
  const delQ=(type,id)=>{
    if(type==="bekitu")setForm(p=>({...p,bekituQs:p.bekituQs.filter(q=>q.id!==id)}));
    else setForm(p=>({...p,hwQs:p.hwQs.filter(q=>q.id!==id)}));
  };
  const QForm=({type})=>{
    const src=type==="bekitu"?newBekitu:newHw;
    const setSrc=type==="bekitu"?setNewBekitu:setNewHw;
    const qs=type==="bekitu"?form.bekituQs||[]:form.hwQs||[];
    return(
      <div>
        {qs.length>0&&(
          <div style={{marginBottom:12}}>
            {qs.map((q,i)=>(
              <div key={q.id} style={{background:"#F8FAFF",borderRadius:8,padding:"8px 12px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:12}}>{i+1}. {q.q}
                    {q.type==="match"&&<span style={{marginLeft:6,fontSize:10,background:"#EDE9FE",color:"#7C3AED",borderRadius:6,padding:"1px 6px"}}>сәйкестендіру</span>}
                    {q.multi&&<span style={{marginLeft:6,fontSize:10,background:"#DBEAFE",color:"#1D4ED8",borderRadius:6,padding:"1px 6px"}}>бірнеше жауап</span>}
                  </div>
                  {q.type==="match"?
                    <div style={{fontSize:11,color:"#22C55E"}}>✓ {(q.pairs||[]).length} жұп сәйкестендіру</div>
                  :q.multi?
                    <div style={{fontSize:11,color:"#22C55E"}}>✓ {(q.ans_all||[]).map(i2=>q.opts?.[i2]).filter(Boolean).join(", ")}</div>
                  :
                    <div style={{fontSize:11,color:"#22C55E"}}>✓ {q.opts?.[q.ans]}</div>
                  }
                </div>
                <button onClick={()=>delQ(type,q.id)} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"2px 7px",fontSize:11,flexShrink:0}}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{background:"#EEF2FF",borderRadius:12,padding:12}}>
          <div style={{fontWeight:700,fontSize:12,color:"#4F46E5",marginBottom:8}}>+ Жаңа сұрақ</div>
          <textarea value={src.q} onChange={e=>setSrc(p=>({...p,q:e.target.value}))}
            style={{...inp,height:52,resize:"none",width:"100%",marginBottom:8}} placeholder="Сұрақ мәтіні..."/>
          {["A","B","C","D"].map((lbl,i)=>(
            <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
              <div onClick={()=>setSrc(p=>({...p,ans:i}))} style={{width:28,height:28,borderRadius:7,
                background:src.ans===i?"#4F46E5":"#E8ECFF",display:"flex",alignItems:"center",justifyContent:"center",
                fontWeight:800,fontSize:12,color:src.ans===i?"#fff":"#6B7280",cursor:"pointer",flexShrink:0}}>{lbl}</div>
              <input value={src.opts[i]} onChange={e=>{const o=[...src.opts];o[i]=e.target.value;setSrc(p=>({...p,opts:o}))}}
                style={{...inp,flex:1}} placeholder={`${i===src.ans?"✓ Дұрыс жауап":"Жауап "+(i+1)}...`}/>
            </div>
          ))}
          <input value={src.exp} onChange={e=>setSrc(p=>({...p,exp:e.target.value}))}
            style={{...inp,marginTop:4,marginBottom:8}} placeholder="💡 Түсіндірме (міндетті емес)"/>
          <button onClick={()=>addQ(type)} style={{...GC.btn,...GC.pri,width:"100%",padding:9,fontSize:12}}>
            + Сұрақ қосу
          </button>
        </div>
      </div>
    );
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16,overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:"min(640px,100%)",maxHeight:"92vh",overflowY:"auto",padding:28,position:"relative"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontWeight:900,fontSize:18,color:"#1E1B4B"}}>{isNew?"+ Сабақ қосу":"Сабақты өңдеу"}</h2>
          <button onClick={()=>setModal(null)} style={{...GC.btn,background:"#F3F4F6",color:"#6B7280",padding:"6px 12px",fontSize:13}}>✕ Жабу</button>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>САБАҚ АТАУЫ</label>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
              style={{...inp,flex:1,fontSize:14}} placeholder="Сабақ атауы..."/>
            <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",whiteSpace:"nowrap",
              background:form.isFree?"#EEF2FF":"#F9FAFB",borderRadius:8,padding:"8px 12px",border:`1px solid ${form.isFree?"#4F46E5":"#E5E7EB"}`}}>
              <input type="checkbox" checked={!!form.isFree} onChange={e=>setForm(p=>({...p,isFree:e.target.checked}))} style={{accentColor:"#4F46E5"}}/>
              <span style={{fontSize:12,fontWeight:700,color:form.isFree?"#4F46E5":"#9CA3AF"}}>ТЕГІН САБАҚ</span>
            </label>
          </div>
        </div>
        <div style={{border:"2px dashed #C7D2FE",borderRadius:14,padding:14,marginBottom:16,background:"#F5F6FF"}}>
          <label style={{fontSize:11,fontWeight:700,color:"#4F46E5",display:"block",marginBottom:6,letterSpacing:1}}>📄 ФАЙЛДАН АВТО-ТОЛТЫРУ (.docx / .md / .txt)</label>
          <input type="file" accept=".docx,.md,.txt" disabled={parsing}
            onChange={async(e)=>{
              const file=e.target.files?.[0];
              if(!file)return;
              setParsing(true);
              try{
                let text="";
                if(file.name.toLowerCase().endsWith(".docx")){
                  const buf=await file.arrayBuffer();
                  const res=await mammoth.extractRawText({arrayBuffer:buf});
                  text=res.value||"";
                }else{
                  text=await file.text();
                }
                const parsed=parseUploadedChapterDoc(text);
                setForm(p=>({
                  ...p,
                  description:parsed.theory||p.description,
                  videoUrl:parsed.videoUrl||p.videoUrl,
                  pdfUrl:parsed.pdfUrl||p.pdfUrl,
                  bekituQs:[...(p.bekituQs||[]),...parsed.questions],
                }));
                showToast(`Талданды: теория ${parsed.theory?parsed.theory.length+" таңба":"жоқ"}, ${parsed.questions.length} сұрақ қосылды ✅`);
              }catch(err){
                console.error(err);
                showToast("Файлды талдау сәтсіз аяқталды — форматын тексеріңіз","err");
              }
              setParsing(false);
              e.target.value="";
            }}
            style={{fontSize:12,width:"100%"}}/>
          {parsing&&<div style={{fontSize:12,color:"#4F46E5",marginTop:6}}>⏳ Талдау жүріп жатыр...</div>}
          <div style={{fontSize:11,color:"#9CA3AF",marginTop:6}}>Файл құрылымы: § бөлімдер = теория, «БӨЛІМ 1-4» + «ЖАУАП КІЛТІ» = тесттер. Нәтиже төменде тексеріп, ✅ Сақтау басыңыз.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:12,marginBottom:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>ВИДЕО URL</label>
            <input value={form.videoUrl||""} onChange={e=>setForm(p=>({...p,videoUrl:e.target.value}))}
              style={inp} placeholder="https://www.youtube.com/embed/..."/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>КОНСПЕКТ PDF URL</label>
            <input value={form.pdfUrl||""} onChange={e=>setForm(p=>({...p,pdfUrl:e.target.value}))}
              style={inp} placeholder="https://example.com/slide.pdf"/>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>САБАҚ МӘТІНІ</label>
          <textarea value={form.description||""} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
            style={{...inp,height:80,resize:"vertical",width:"100%"}} placeholder="Сабақ мазмұны..."/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:12,marginBottom:14}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>ҰЗАҚТЫҒЫ</label>
            <input value={form.duration||"15 мин"} onChange={e=>setForm(p=>({...p,duration:e.target.value}))} style={inp} placeholder="15 мин"/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>ҚАТЕ ЖҰМЫС — ВИДЕО URL</label>
            <input value={form.errorVideoUrl||""} onChange={e=>setForm(p=>({...p,errorVideoUrl:e.target.value}))} style={inp} placeholder="YouTube сілтемесі..."/>
          </div>
        </div>
        <div style={{marginBottom:18}}>
          <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:5,letterSpacing:1}}>ҚАТЕ ЖҰМЫС — PDF URL</label>
          <input value={form.errorPdfUrl||""} onChange={e=>setForm(p=>({...p,errorPdfUrl:e.target.value}))} style={inp} placeholder="Google Drive PDF..."/>
        </div>
        <div style={{border:"2px solid #EEF0FF",borderRadius:14,overflow:"hidden",marginBottom:20}}>
          <div style={{display:"flex",borderBottom:"2px solid #EEF0FF"}}>
            {[["bekitu","✅ Бекіту",(form.bekituQs||[]).length],["hw","📝 Үй жұмысы",(form.hwQs||[]).length]].map(([id,label,cnt])=>(
              <button key={id} onClick={()=>setQTab(id)} style={{...GC.btn,flex:1,padding:"10px 8px",fontSize:13,borderRadius:0,
                background:qTab===id?"#EEF2FF":"#fff",color:qTab===id?"#4F46E5":"#6B7280",fontWeight:qTab===id?800:500}}>
                {label} <span style={{background:"#EEF0FF",borderRadius:99,padding:"1px 7px",fontSize:10,marginLeft:4}}>{cnt}</span>
              </button>
            ))}
          </div>
          <div style={{padding:14}}>
            <QForm type={qTab}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setModal(null)} style={{...GC.btn,...GC.sec,flex:1,padding:12,fontSize:14}}>Бас тарту</button>
          <button onClick={()=>{
            if(!form.title?.trim())return showToast("Сабақ атауы міндетті","err");
            setContent(p=>{
              const lid=isNew?"l"+Date.now():form.id;
              const newTopics=(p.topics?.[selSub.id]||[]).map(t=>t.id!==modal.topicId?t:{...t,
                lessons:isNew?[...t.lessons,{id:lid,title:form.title,duration:form.duration||"15 мін",videoUrl:form.videoUrl||"",pdfUrl:form.pdfUrl||"",description:form.description||"",isFree:form.isFree}]:
                  t.lessons.map(l=>l.id===form.id?{...l,title:form.title,duration:form.duration,videoUrl:form.videoUrl,pdfUrl:form.pdfUrl,description:form.description,isFree:form.isFree}:l)
              });
              const finalId=isNew?newTopics.find(t=>t.id===modal.topicId)?.lessons.slice(-1)[0]?.id||lid:form.id;
              return{...p,
                topics:{...p.topics,[selSub.id]:newTopics},
                lessonTests:{...p.lessonTests,[finalId]:form.bekituQs||[]},
                hwTests:{...p.hwTests,[finalId]:form.hwQs||[]},
                lessonErrorWork:{...p.lessonErrorWork,[finalId]:{videoUrl:form.errorVideoUrl||"",pdfUrl:form.errorPdfUrl||""}},
                unlockedLessons:{...p.unlockedLessons,[selSub.id]:form.isFree?[...new Set([...(p.unlockedLessons?.[selSub.id]||[]),finalId])]:(p.unlockedLessons?.[selSub.id]||[]).filter(x=>x!==finalId)},
              };
            });
            setModal(null);showToast(isNew?"Сабақ қосылды ✅":"Сабақ сақталды ✅");
          }} style={{...GC.btn,...GC.pri,flex:2,padding:12,fontSize:14,fontWeight:800}}>
            {isNew?"✅ Сабақ қосу":"💾 Сақтау"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TopicsView({selSub,getTops,setContent,setSelTopic,setView,addTopicName,setAddTopicName,saveTopic,delTopic,modal,setModal,content,showToast}){
  const [dragIdx,setDragIdx]=React.useState(null);
  const [editTopicId,setEditTopicId]=React.useState(null);
  const [editTopicVal,setEditTopicVal]=React.useState("");
  const tops=getTops(selSub.id);

  const moveTop=(from,to)=>{
    const arr=[...getTops(selSub.id)];
    const [it]=arr.splice(from,1);arr.splice(to,0,it);
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:arr}}));
  };
  const renTopic=(id,val)=>{
    if(!val.trim())return;
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>t.id===id?{...t,title:val.trim()}:t)}}));
    setEditTopicId(null);showToast("Тарау атауы өзгертілді ✅");
  };
  return(
    <div style={{paddingBottom:24}}>
      {modal&&<LessonModal modal={modal} setModal={setModal} selSub={selSub} content={content} setContent={setContent} showToast={showToast}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <button onClick={()=>setView("subjects")} style={{...GC.btn,...GC.sec,padding:"6px 12px",fontSize:13,marginBottom:8}}>← Пәндерге қайту</button>
          <h2 style={{fontWeight:900,fontSize:20,color:"#1E1B4B"}}>{selSub.icon} {selSub.name} — Тараулар</h2>
          <div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>⠿ Сүйреп орнын ауыстырыңыз • Атауды басып өзгертіңіз</div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {tops.map((tp,i)=>(
          <div key={tp.id}
            onDragOver={e=>e.preventDefault()}
            onDrop={()=>{if(dragIdx!==null&&dragIdx!==i){moveTop(dragIdx,i);}setDragIdx(null);}}
            style={{...GC.card,padding:"14px 16px",display:"flex",alignItems:"center",gap:10,
              border:`2px solid ${dragIdx===i?"#4F46E5":"#EEF0FF"}`,
              background:dragIdx===i?"#EEF2FF":"#fff",
              opacity:dragIdx!==null&&dragIdx!==i?0.5:1,
              transition:"all 0.15s"}}>
            <div draggable
              onDragStart={e=>{e.stopPropagation();setDragIdx(i);}}
              style={{color:"#C4C9D4",fontSize:20,cursor:"grab",userSelect:"none",flexShrink:0,padding:"4px"}}>⠿</div>
            <div style={{width:32,height:32,borderRadius:8,background:selSub.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:selSub.color,fontSize:13,flexShrink:0}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              {editTopicId===tp.id
                ?<input autoFocus value={editTopicVal}
                    onChange={e=>setEditTopicVal(e.target.value)}
                    onBlur={()=>renTopic(tp.id,editTopicVal)}
                    onKeyDown={e=>{if(e.key==="Enter")renTopic(tp.id,editTopicVal);if(e.key==="Escape")setEditTopicId(null);}}
                    onClick={e=>e.stopPropagation()}
                    style={{...GC.input,fontWeight:800,fontSize:14,padding:"6px 10px"}}/>
                :<div onClick={()=>{setEditTopicId(tp.id);setEditTopicVal(tp.title);}}
                    style={{fontWeight:800,fontSize:14,color:"#1E1B4B",cursor:"text",padding:"4px 0"}}>
                    {tp.title} <span style={{fontSize:11,color:"#C4C9D4"}}>✏️</span>
                  </div>
              }
              <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{tp.lessons.length} сабақ</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {i>0&&<button onClick={e=>{e.stopPropagation();moveTop(i,i-1);}} style={{...GC.btn,background:"#F5F7FF",color:"#4F46E5",padding:"6px 10px",fontSize:14}}>↑</button>}
              {i<tops.length-1&&<button onClick={e=>{e.stopPropagation();moveTop(i,i+1);}} style={{...GC.btn,background:"#F5F7FF",color:"#4F46E5",padding:"6px 10px",fontSize:14}}>↓</button>}
              <button onClick={e=>{e.stopPropagation();setSelTopic(tp);setView("lessons");}} style={{...GC.btn,background:selSub.bg,color:selSub.color,padding:"6px 14px",fontSize:13,fontWeight:700}}>Ашу →</button>
              <button onClick={e=>{e.stopPropagation();if(window.confirm("Тарауды жою?\n"+tp.title)){delTopic(tp.id);}}} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"6px 10px",fontSize:14}}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{...GC.card,padding:16,border:"2px dashed #C7D2FE",marginBottom:32}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#4F46E5"}}>📂 Жаңа тарау қосу</div>
        <div style={{display:"flex",gap:8}}>
          <input value={addTopicName} onChange={e=>setAddTopicName(e.target.value)}
            style={{...GC.input,flex:1}} placeholder="Тарау атауы..."
            onKeyDown={e=>e.key==="Enter"&&saveTopic()}/>
          <button onClick={saveTopic} style={{...GC.btn,...GC.pri,padding:"10px 18px",flexShrink:0}}>+ Қосу</button>
        </div>
      </div>
    </div>
  );
}

function LessonsView({selSub,selTopic,getTops,setContent,setView,setModal,delLesson,content,modal,showToast}){
  const [dragLsIdx,setDragLsIdx]=React.useState(null);
  const [editLsId,setEditLsId]=React.useState(null);
  const [editLsVal,setEditLsVal]=React.useState("");
  const tp=getTops(selSub.id).find(t=>t.id===selTopic.id)||selTopic;
  const allTops=getTops(selSub.id);

  const moveLs=(from,to)=>{
    const arr=[...tp.lessons];
    const [it]=arr.splice(from,1);arr.splice(to,0,it);
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>t.id===tp.id?{...t,lessons:arr}:t)}}));
  };
  const moveLsToTopic=(lsId,targetTopicId)=>{
    const ls=tp.lessons.find(l=>l.id===lsId);
    if(!ls)return;
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>{
      if(t.id===tp.id)return{...t,lessons:t.lessons.filter(l=>l.id!==lsId)};
      if(t.id===targetTopicId)return{...t,lessons:[...t.lessons,ls]};
      return t;
    })}}));
    showToast("Сабақ жылжытылды ✅");
  };
  const renLesson=(lsId,val)=>{
    if(!val.trim())return;
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>t.id===tp.id?{...t,lessons:t.lessons.map(l=>l.id===lsId?{...l,title:val.trim()}:l)}:t)}}));
    setEditLsId(null);showToast("Сабақ атауы өзгертілді ✅");
  };
  return(
    <div>
      {modal&&<LessonModal modal={modal} setModal={setModal} selSub={selSub} content={content} setContent={setContent} showToast={showToast}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <button onClick={()=>setView("topics")} style={{...GC.btn,...GC.sec,padding:"6px 12px",fontSize:13,marginBottom:6}}>← Тараулар</button>
          <h2 style={{fontWeight:900,fontSize:18,color:"#1E1B4B"}}>{tp.title}</h2>
          <div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>{tp.lessons.length} сабақ • ⠿ сүйреп орнын ауыстырыңыз • атауды басып өзгертіңіз</div>
        </div>
        <button onClick={()=>setModal({topicId:selTopic.id,isNew:true})} style={{...GC.btn,...GC.pri,padding:"10px 20px",fontSize:14,fontWeight:800}}>+ САБАҚ ҚОСУ</button>
      </div>
      {tp.lessons.length===0&&(
        <div style={{...GC.card,padding:40,textAlign:"center",color:"#9CA3AF"}}>
          <div style={{fontSize:48,marginBottom:12}}>📖</div>
          <div style={{fontWeight:700,fontSize:15}}>Сабақтар жоқ</div>
          <div style={{fontSize:13,marginTop:4}}>«+ САБАҚ ҚОСУ» батырмасын басыңыз</div>
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {tp.lessons.map((ls,i)=>{
          const bQs=content.lessonTests?.[ls.id]||[];
          const hQs=content.hwTests?.[ls.id]||[];
          const errW=content.lessonErrorWork?.[ls.id];
          const hasErr=errW?.videoUrl||errW?.pdfUrl;
          const isDragging=dragLsIdx===i;
          return(
            <div key={ls.id}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>{if(dragLsIdx!==null&&dragLsIdx!==i){moveLs(dragLsIdx,i);}setDragLsIdx(null);}}
              style={{...GC.card,padding:"12px 14px",display:"flex",alignItems:"flex-start",gap:10,
                border:`2px solid ${isDragging?"#4F46E5":"#EEF0FF"}`,
                background:isDragging?"#EEF2FF":"#fff",
                opacity:dragLsIdx!==null&&!isDragging?0.5:1,
                transition:"all 0.12s"}}>
              <div draggable onDragStart={e=>{e.stopPropagation();setDragLsIdx(i);}} style={{color:"#C4C9D4",fontSize:20,paddingTop:2,cursor:"grab",userSelect:"none",flexShrink:0,padding:"4px"}}>⠿</div>
              <div style={{width:30,height:30,borderRadius:8,background:selSub.bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:selSub.color,fontSize:12,flexShrink:0,marginTop:1}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                {editLsId===ls.id
                  ?<input autoFocus value={editLsVal}
                      onChange={e=>setEditLsVal(e.target.value)}
                      onBlur={()=>renLesson(ls.id,editLsVal)}
                      onKeyDown={e=>{if(e.key==="Enter")renLesson(ls.id,editLsVal);if(e.key==="Escape")setEditLsId(null);}}
                      onClick={e=>e.stopPropagation()}
                      style={{...GC.input,fontWeight:800,fontSize:13,padding:"5px 8px",marginBottom:6}}/>
                  :<div onClick={()=>{setEditLsId(ls.id);setEditLsVal(ls.title);}}
                      style={{fontWeight:800,fontSize:13,color:"#1E1B4B",cursor:"text",marginBottom:4}}>
                      {ls.title} <span style={{fontSize:10,color:"#C4C9D4"}}>✏️</span>
                    </div>
                }
                <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                  <span style={{...GC.tag,...GC.sec,fontSize:10}}>⏱ {ls.duration}</span>
                  {ls.videoUrl&&<span style={{...GC.tag,background:"#EEF2FF",color:"#4F46E5",fontSize:10}}>📹</span>}
                  {ls.pdfUrl&&<span style={{...GC.tag,background:"#F0FFF4",color:"#22C55E",fontSize:10}}>📄</span>}
                  {bQs.length>0&&<span style={{...GC.tag,background:"#FFFBEB",color:"#F59E0B",fontSize:10}}>✅{bQs.length}</span>}
                  {hQs.length>0&&<span style={{...GC.tag,background:"#FFF5F5",color:"#EF4444",fontSize:10}}>📝{hQs.length}</span>}
                  {hasErr&&<span style={{...GC.tag,background:"#F0FFF4",color:"#22C55E",fontSize:10}}>🔄</span>}
                  {ls.isFree&&<span style={{...GC.tag,background:"#EEF2FF",color:"#4F46E5",fontSize:10}}>🔓</span>}
                </div>
                {allTops.length>1&&(
                  <div style={{marginTop:6}}>
                    <select defaultValue="" onChange={e=>{if(e.target.value){moveLsToTopic(ls.id,e.target.value);}e.target.value="";}}
                      style={{...GC.input,fontSize:11,padding:"3px 6px",color:"#9CA3AF",height:"auto"}}
                      onClick={e=>e.stopPropagation()}>
                      <option value="">📂 Тарауға жылжыту...</option>
                      {allTops.filter(t=>t.id!==tp.id).map(t=>(
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
                <div style={{display:"flex",gap:5}}>
                  {i>0&&<button onClick={e=>{e.stopPropagation();moveLs(i,i-1);}} style={{...GC.btn,background:"#F5F7FF",color:"#4F46E5",padding:"4px 8px",fontSize:12}}>↑</button>}
                  {i<tp.lessons.length-1&&<button onClick={e=>{e.stopPropagation();moveLs(i,i+1);}} style={{...GC.btn,background:"#F5F7FF",color:"#4F46E5",padding:"4px 8px",fontSize:12}}>↓</button>}
                </div>
                <button onClick={()=>setModal({lesson:ls,topicId:selTopic.id})} style={{...GC.btn,background:"#EEF2FF",color:"#4F46E5",padding:"6px 12px",fontSize:12,fontWeight:700}}>✏️ Өңдеу</button>
                <button onClick={()=>{if(window.confirm("Сабақты жою?\n"+ls.title))delLesson(selTopic.id,ls.id);}} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"6px 10px",fontSize:12}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminContentManager({content,setContent,showToast}){
  const [view,setView]=useState("subjects"); // subjects | topics | lessons
  const [selSub,setSelSub]=useState(null);
  const [selTopic,setSelTopic]=useState(null);
  const [modal,setModal]=useState(null); // {lesson, topicId} or {newLesson, topicId}
  const [addTopicName,setAddTopicName]=useState("");

  const GI={...GC};
  const inp={...GC.input,fontSize:13,marginBottom:0};

  // ── helpers ──
  const getTops=(sid)=>((content.topics||{})[sid]||[]).map(t=>({...t,lessons:Array.isArray(t.lessons)?t.lessons:[]}));
  const saveTopic=()=>{
    if(!addTopicName.trim())return showToast("Тақырып атауын жазыңыз","err");
    const t={id:"t"+Date.now(),title:addTopicName.trim(),lessons:[]};
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:[...getTops(selSub.id),t]}}));
    setAddTopicName("");showToast("Тақырып қосылды ✅");
  };
  const delTopic=(tid)=>{
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).filter(t=>t.id!==tid)}}));
    showToast("Жойылды","err");
  };
  const saveLesson=(lesson,topicId,isNew)=>{
    if(!lesson.title?.trim())return showToast("Сабақ атауы міндетті","err");
    setContent(p=>({...p,
      topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>t.id!==topicId?t:{...t,
        lessons:isNew?[...t.lessons,{...lesson,id:"l"+Date.now()}]:t.lessons.map(l=>l.id===lesson.id?lesson:l)
      })},
      lessonTests:{...p.lessonTests,[isNew?"l"+Date.now():lesson.id]:lesson.bekituQs||p.lessonTests?.[lesson.id]||[]},
      hwTests:{...p.hwTests,[isNew?"l"+Date.now():lesson.id]:lesson.hwQs||p.hwTests?.[lesson.id]||[]},
    }));
    // Save bekitu & hw questions separately if editing existing
    if(!isNew){
      setContent(p=>({...p,
        lessonTests:{...p.lessonTests,[lesson.id]:lesson.bekituQs||[]},
        hwTests:{...p.hwTests,[lesson.id]:lesson.hwQs||[]},
        lessonErrorWork:{...p.lessonErrorWork,[lesson.id]:{videoUrl:lesson.errorVideoUrl||"",pdfUrl:lesson.errorPdfUrl||""}},
      }));
    }
    setModal(null);showToast(isNew?"Сабақ қосылды ✅":"Сабақ сақталды ✅");
  };
  const delLesson=(tid,lid)=>{
    setContent(p=>({...p,topics:{...p.topics,[selSub.id]:getTops(selSub.id).map(t=>t.id!==tid?t:{...t,lessons:t.lessons.filter(l=>l.id!==lid)})}}));
    showToast("Жойылды","err");
  };


  // ── SUBJECTS GRID ──
  if(view==="subjects") return(
    <div>
      <div style={{fontWeight:900,fontSize:20,color:"#1E1B4B",marginBottom:16}}>📚 Пәндер</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
        {SUBJECTS.map(s=>{
          const tops=getTops(s.id);
          const lessons=tops.reduce((a,t)=>a+t.lessons.length,0);
          return(
            <div key={s.id} onClick={()=>{setSelSub(s);setView("topics");}}
              style={{...GC.card,padding:18,cursor:"pointer",border:`2px solid ${s.bg}`,transition:"all 0.2s",
                ':hover':{transform:"translateY(-2px)"}}}>
              <div style={{fontSize:32,marginBottom:8}}>{s.icon}</div>
              <div style={{fontWeight:800,fontSize:14,color:"#1E1B4B",marginBottom:4}}>{s.name}</div>
              <div style={{fontSize:12,color:"#9CA3AF"}}>{tops.length} тақырып • {lessons} сабақ</div>
              <div style={{marginTop:8,height:4,borderRadius:99,background:"#EEF0FF"}}>
                <div style={{height:4,borderRadius:99,background:s.color,width:`${Math.min(100,lessons*8)}%`}}/>
              </div>
            </div>
          );
        })}
      </div>
      {modal&&<LessonModal modal={modal} setModal={setModal} selSub={selSub} content={content} setContent={setContent} showToast={showToast}/>}
    </div>
  );

  // ── TOPICS VIEW delegated to sub-component ──
  if(view==="topics"&&selSub) return <TopicsView selSub={selSub} getTops={getTops} setContent={setContent} setSelTopic={setSelTopic} setView={setView} addTopicName={addTopicName} setAddTopicName={setAddTopicName} saveTopic={saveTopic} delTopic={delTopic} modal={modal} setModal={setModal} content={content} showToast={showToast}/>;

  // ── LESSONS VIEW delegated to sub-component ──
  if(view==="lessons"&&selSub&&selTopic) return <LessonsView selSub={selSub} selTopic={selTopic} getTops={getTops} setContent={setContent} setView={setView} setModal={setModal} delLesson={delLesson} content={content} modal={modal} showToast={showToast}/>;

  return null;
}



/* ════════════════════════════════════════════════════════
   ADMIN: VARIANT MANAGER — ҰБТ тест нұсқалары
════════════════════════════════════════════════════════ */
function AdminVariantManager({content,setContent,showToast}){
  const [view,setView]=useState("subjects"); // subjects | variants | questions
  const [selSub,setSelSub]=useState(null);
  const [selVariant,setSelVariant]=useState(null);
  const [addVarName,setAddVarName]=useState("");
  const [editQ,setEditQ]=useState(null); // {q, idx} or null = add new
  const [qForm,setQForm]=useState({q:"",opts:["","","",""],ans:0,exp:"",topic:""});

  const getVariants=(sid)=>(content.variants||{})[sid]||[];
  const saveVariant=()=>{
    const name=addVarName.trim();
    if(!name)return showToast("Нұсқа атауын жазыңыз","err");
    const nv={id:"var"+Date.now(),title:name,questions:[]};
    setContent(p=>({...p,variants:{...(p.variants||{}),[selSub.id]:[...getVariants(selSub.id),nv]}}));
    setAddVarName("");showToast("Нұсқа қосылды ✅");
  };
  const delVariant=(vid)=>{
    if(!confirm("Нұсқаны жою?"))return;
    setContent(p=>({...p,variants:{...(p.variants||{}),[selSub.id]:getVariants(selSub.id).filter(v=>v.id!==vid)}}));
    showToast("Жойылды","err");
  };
  const saveQ=()=>{
    if(!qForm.q.trim()||qForm.opts.some(o=>!o.trim()))return showToast("Барлық өрісті толтырыңыз","err");
    const variants=getVariants(selSub.id);
    const vIdx=variants.findIndex(v=>v.id===selVariant.id);
    if(vIdx===-1)return;
    const qs=[...variants[vIdx].questions];
    if(editQ!==null&&editQ.idx>=0){
      qs[editQ.idx]={...qs[editQ.idx],...qForm};
    } else {
      qs.push({id:"q"+Date.now(),...qForm});
    }
    const newVars=[...variants];
    newVars[vIdx]={...newVars[vIdx],questions:qs};
    setContent(p=>({...p,variants:{...(p.variants||{}),[selSub.id]:newVars}}));
    setSelVariant(newVars[vIdx]);
    setEditQ(null);
    setQForm({q:"",opts:["","","",""],ans:0,exp:"",topic:""});
    showToast(editQ!==null&&editQ.idx>=0?"Сұрақ жаңартылды ✅":"Сұрақ қосылды ✅");
  };
  const delQ=(qi)=>{
    const variants=getVariants(selSub.id);
    const vIdx=variants.findIndex(v=>v.id===selVariant.id);
    const newQs=variants[vIdx].questions.filter((_,i)=>i!==qi);
    const newVars=[...variants];
    newVars[vIdx]={...newVars[vIdx],questions:newQs};
    setContent(p=>({...p,variants:{...(p.variants||{}),[selSub.id]:newVars}}));
    setSelVariant(newVars[vIdx]);
    showToast("Сұрақ жойылды","err");
  };
  const startEditQ=(q,idx)=>{
    setEditQ({q,idx});
    setQForm({q:q.q,opts:[...q.opts],ans:q.ans,exp:q.exp||"",topic:q.topic||""});
  };

  const QFormUI=()=>(
    <div style={{background:"#F8FAFF",borderRadius:14,padding:16,marginBottom:16,border:"2px solid #4F46E5"}}>
      <div style={{fontWeight:800,fontSize:14,color:"#4F46E5",marginBottom:12}}>
        {editQ!==null&&editQ.idx>=0?"✏️ Сұрақты өңдеу":"➕ Жаңа сұрақ қосу"}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <input value={qForm.topic} onChange={e=>setQForm(p=>({...p,topic:e.target.value}))}
          style={GC.input} placeholder="Тақырып (міндетті емес)"/>
        <div style={{display:"flex",alignItems:"center",gap:6,background:"#EEF2FF",borderRadius:8,padding:"0 10px",fontSize:12,color:"#4F46E5",fontWeight:700}}>
          {(getVariants(selSub?.id).find(v=>v.id===selVariant?.id)?.questions.length||0)+1}
          {editQ!==null&&editQ.idx>=0?"-сұрақ өңдеу":"-ші сұрақ"}
        </div>
      </div>
      <textarea value={qForm.q} onChange={e=>setQForm(p=>({...p,q:e.target.value}))}
        style={{...GC.input,height:64,resize:"none",marginBottom:10,width:"100%"}} placeholder="Сұрақ мәтіні..."/>
      {["A","B","C","D"].map((lbl,i)=>(
        <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"center"}}>
          <div onClick={()=>setQForm(p=>({...p,ans:i}))} style={{
            width:32,height:32,borderRadius:8,cursor:"pointer",flexShrink:0,
            background:qForm.ans===i?"linear-gradient(135deg,#4F46E5,#7C3AED)":"#E8ECFF",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontWeight:900,fontSize:13,color:qForm.ans===i?"#fff":"#6B7280"}}>{lbl}</div>
          <input value={qForm.opts[i]} onChange={e=>{const o=[...qForm.opts];o[i]=e.target.value;setQForm(p=>({...p,opts:o}))}}
            style={{...GC.input,flex:1}} placeholder={`${lbl} жауабы...`}/>
        </div>
      ))}
      <input value={qForm.exp} onChange={e=>setQForm(p=>({...p,exp:e.target.value}))}
        style={{...GC.input,marginTop:6,marginBottom:10}} placeholder="💡 Түсіндірме (міндетті емес)"/>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{setEditQ(null);setQForm({q:"",opts:["","","",""],ans:0,exp:"",topic:""});}}
          style={{...GC.btn,...GC.sec,flex:1,padding:9,fontSize:13}}>Бас тарту</button>
        <button onClick={saveQ} style={{...GC.btn,...GC.pri,flex:2,padding:9,fontSize:13,fontWeight:800}}>
          {editQ!==null&&editQ.idx>=0?"💾 Жаңарту":"✅ Қосу"}
        </button>
      </div>
    </div>
  );

  // SUBJECTS VIEW
  if(view==="subjects") return(
    <div>
      <div style={{fontWeight:900,fontSize:18,color:"#1E1B4B",marginBottom:16}}>📋 Тест нұсқалары — Пәндер</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
        {SUBJECTS.map(s=>{
          const vars=getVariants(s.id);
          const totalQs=vars.reduce((a,v)=>a+v.questions.length,0);
          return(
            <div key={s.id} onClick={()=>{setSelSub(s);setView("variants");}}
              style={{...GC.card,padding:18,cursor:"pointer",border:`2px solid ${s.bg}`,transition:"all 0.2s"}}>
              <div style={{fontSize:30,marginBottom:8}}>{s.icon}</div>
              <div style={{fontWeight:800,fontSize:14,color:"#1E1B4B",marginBottom:4}}>{s.name}</div>
              <div style={{fontSize:12,color:"#9CA3AF"}}>{vars.length} нұсқа • {totalQs} сұрақ</div>
              <div style={{marginTop:8,height:4,borderRadius:99,background:"#EEF0FF"}}>
                <div style={{height:4,borderRadius:99,background:s.color,width:`${Math.min(100,vars.length*10)}%`}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // VARIANTS VIEW
  if(view==="variants"&&selSub) return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
        <button onClick={()=>setView("subjects")} style={{...GC.btn,...GC.sec,padding:"6px 14px",fontSize:13}}>← Артқа</button>
        <span style={{fontSize:22}}>{selSub.icon}</span>
        <span style={{fontWeight:900,fontSize:18,color:"#1E1B4B"}}>{selSub.name} — Нұсқалар</span>
      </div>
      {/* Add variant */}
      <div style={{...GC.card,padding:16,marginBottom:16,display:"flex",gap:10,alignItems:"center",background:"#F0F4FF"}}>
        <input value={addVarName} onChange={e=>setAddVarName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&saveVariant()}
          style={{...GC.input,flex:1}} placeholder="Нұсқа атауы... (мыс: 1-нұсқа, 2025 нұсқа)"/>
        <button onClick={saveVariant} style={{...GC.btn,...GC.pri,padding:"9px 18px",fontWeight:800,whiteSpace:"nowrap"}}>+ Нұсқа қосу</button>
      </div>
      {getVariants(selSub.id).length===0&&(
        <div style={{textAlign:"center",padding:40,color:"#9CA3AF"}}>Нұсқалар жоқ. Алдымен нұсқа қосыңыз.</div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {getVariants(selSub.id).map((v,idx)=>(
          <div key={v.id} style={{...GC.card,padding:"14px 18px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:16,flexShrink:0}}>{idx+1}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:"#1E1B4B"}}>{v.title}</div>
              <div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>{v.questions.length} сұрақ</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setSelVariant(v);setView("questions");setEditQ(null);setQForm({q:"",opts:["","","",""],ans:0,exp:"",topic:""});}}
                style={{...GC.btn,...GC.pri,padding:"7px 14px",fontSize:13}}>✏️ Сұрақтар</button>
              <button onClick={()=>delVariant(v.id)} style={{...GC.btn,...GC.danger,padding:"7px 10px",fontSize:13}}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // QUESTIONS VIEW
  if(view==="questions"&&selSub&&selVariant){
    const currentVarData=getVariants(selSub.id).find(v=>v.id===selVariant.id)||selVariant;
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
          <button onClick={()=>{setView("variants");setEditQ(null);}} style={{...GC.btn,...GC.sec,padding:"6px 14px",fontSize:13}}>← Нұсқаларға</button>
          <span style={{fontSize:18}}>{selSub.icon}</span>
          <span style={{fontWeight:900,fontSize:16,color:"#1E1B4B"}}>{currentVarData.title}</span>
          <span style={{...GC.tag,...GC.sec,fontSize:11}}>{currentVarData.questions.length} сұрақ</span>
          {currentVarData.questions.length<20&&(
            <span style={{...GC.tag,background:"#FEF3C7",color:"#92400E",fontSize:11}}>⚠️ ҰБТ стандарты: 20-40 сұрақ</span>
          )}
        </div>

        {/* Add/Edit question form - always show */}
        {(editQ!==null||true)&&<QFormUI/>}

        {/* Questions list */}
        {currentVarData.questions.length===0&&(
          <div style={{textAlign:"center",padding:32,color:"#9CA3AF",background:"#F9FAFB",borderRadius:12}}>
            Сұрақтар жоқ. Жоғарыдан сұрақ қосыңыз.
          </div>
        )}
        {currentVarData.questions.map((q,i)=>(
          <div key={q.id||i} style={{...GC.card,padding:"12px 16px",marginBottom:8,border:editQ?.idx===i?"2px solid #4F46E5":"1px solid #EEF0FF"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1E1B4B",marginBottom:4}}>{i+1}. {q.q}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
                  {q.opts.map((opt,oi)=>(
                    <span key={oi} style={{fontSize:11,padding:"2px 8px",borderRadius:6,
                      background:oi===q.ans?"#DCFCE7":"#F3F4F6",color:oi===q.ans?"#16A34A":"#6B7280",
                      fontWeight:oi===q.ans?800:400}}>
                      {["A","B","C","D"][oi]}: {opt}
                    </span>
                  ))}
                </div>
                {q.topic&&<span style={{...GC.tag,...GC.sec,fontSize:10}}>{q.topic}</span>}
                {q.exp&&<div style={{fontSize:11,color:"#6B7280",marginTop:2}}>💡 <Rich text={q.exp}/></div>}
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <button onClick={()=>startEditQ(q,i)} style={{...GC.btn,background:"#EEF2FF",color:"#4F46E5",padding:"5px 10px",fontSize:12}}>✏️</button>
                <button onClick={()=>delQ(i)} style={{...GC.btn,...GC.danger,padding:"5px 10px",fontSize:12}}>🗑</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}


const AdminAddHW=({content,setContent,showToast})=>{
  const [hw,setHw]=useState({subjectId:SUBJECTS[0].id,lessonId:"",title:"",description:"",dueDate:"",maxScore:10});
  const tops=(content.topics||{})[hw.subjectId]||[];
  const lessons=tops.flatMap(t=>t.lessons);
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:10,marginBottom:10}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Пән</label>
          <select value={hw.subjectId} onChange={e=>setHw(p=>({...p,subjectId:e.target.value,lessonId:""}))} style={GC.input}>{SUBJECTS.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}</select>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Сабақ</label>
          <select value={hw.lessonId} onChange={e=>setHw(p=>({...p,lessonId:e.target.value}))} style={GC.input}>
            <option value="">Таңдаңыз...</option>
            {lessons.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </div>
      </div>
      <input value={hw.title} onChange={e=>setHw(p=>({...p,title:e.target.value}))} style={{...GC.input,marginBottom:10}} placeholder="Тапсырма атауы..."/>
      <textarea value={hw.description} onChange={e=>setHw(p=>({...p,description:e.target.value}))} style={{...GC.input,height:70,resize:"none",marginBottom:10}} placeholder="Тапсырма мазмұны..."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:10,marginBottom:14}}>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Мерзімі</label>
          <input type="date" value={hw.dueDate} onChange={e=>setHw(p=>({...p,dueDate:e.target.value}))} style={GC.input}/>
        </div>
        <div>
          <label style={{fontSize:12,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Максималды балл</label>
          <input type="number" value={hw.maxScore} onChange={e=>setHw(p=>({...p,maxScore:+e.target.value}))} style={GC.input} min="1" max="100"/>
        </div>
      </div>
      <button style={{...GC.btn,...GC.pri,width:"100%",padding:12}} onClick={()=>{
        if(!hw.title||!hw.lessonId)return showToast("Атауы мен сабақты толтырыңыз","err");
        const nhw={id:Date.now(),...hw,submissions:[]};
        setContent(p=>({...p,homework:[...(p.homework||[]),nhw]}));
        showToast("Үй жұмысы қосылды ✅");
        setHw(p=>({...p,title:"",description:"",dueDate:"",lessonId:""}));
      }}>✅ Үй жұмысын қосу</button>
    </div>
  );
};

const AdminAddAnnounce=({content,setContent,users,setUsers,user,showToast})=>{
  const [a,setA]=useState({title:"",body:"",type:"info",pinned:false});
  return(
    <div>
      <input value={a.title} onChange={e=>setA(p=>({...p,title:e.target.value}))} style={{...GC.input,marginBottom:10}} placeholder="Хабарландыру тақырыбы..."/>
      <textarea value={a.body} onChange={e=>setA(p=>({...p,body:e.target.value}))} style={{...GC.input,height:80,resize:"none",marginBottom:10}} placeholder="Хабарландыру мәтіні..."/>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        {[["info","ℹ️ Ақпарат"],["success","✅ Жақсы жаңалық"],["warning","⚠️ Ескерту"],["error","❌ Маңызды"]].map(([v,l])=>(
          <div key={v} onClick={()=>setA(p=>({...p,type:v}))} style={{...GC.tag,cursor:"pointer",background:a.type===v?"#4F46E5":"#EEF0FF",color:a.type===v?"#fff":"#6B7280",padding:"6px 14px",fontSize:12}}>{l}</div>
        ))}
        <div onClick={()=>setA(p=>({...p,pinned:!p.pinned}))} style={{...GC.tag,cursor:"pointer",background:a.pinned?"#F59E0B":"#EEF0FF",color:a.pinned?"#fff":"#6B7280",padding:"6px 14px",fontSize:12}}>📌 Бекіту</div>
      </div>
      <button style={{...GC.btn,...GC.pri,padding:12}} onClick={()=>{
        if(!a.title||!a.body)return showToast("Тақырып пен мәтін толтырыңыз","err");
        const na={id:Date.now(),...a,date:new Date().toLocaleDateString("kk-KZ"),author:user?.name||"Admin"};
        setContent(p=>({...p,announcements:[na,...(p.announcements||[])]}));
        const notif={id:Date.now(),text:`📢 ${a.title}`,read:false,date:new Date().toLocaleDateString("kk-KZ")};
        setUsers(p=>p.map(u=>u.role==="student"?{...u,notifications:[notif,...(u.notifications||[])]}:u));
        showToast("Хабарландыру жіберілді ✅");
        setA({title:"",body:"",type:"info",pinned:false});
      }}>📢 Барлық оқушыға жіберу</button>
    </div>
  );
};

/* ════════════════════════════════════════════════════════
   ADMIN: LESSON MCQ (Бекіту + Үй жұмысы) — with count config + delete
════════════════════════════════════════════════════════ */
function AdminLessonMCQ({mode,content,setContent,showToast}){
  const label=mode==="hw"?"📝 Үй жұмысы":"✅ Бекіту тапсырмасы";
  const storeKey=mode==="hw"?"hwTests":"lessonTests";
  const defaultCount=mode==="hw"?20:10;
  const countKey=mode==="hw"?"hwTestCount":"fixTestCount";

  const [sid,setSid]=useState(SUBJECTS[0].id);
  const [lid,setLid]=useState("");
  const [qs,setQs]=useState([]);
  const [cur,setCur]=useState({q:"",opts:["","","",""],ans:0,exp:""});
  const [open,setOpen]=useState(false);

  const tops=content.topics?.[sid]||[];
  const lessons=tops.flatMap(t=>(t.lessons||[]).map(l=>({...l,topicTitle:t.title})));
  const existing=lid?((content[storeKey]||{})[lid]||[]):[];
  const counts=content[countKey]||{};
  const thisCount=counts[lid]||defaultCount;

  const inp={width:"100%",padding:"10px 12px",borderRadius:10,border:"2px solid #E8ECFF",background:"#FAFAFE",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  const addQ=()=>{
    if(!cur.q||cur.opts.some(o=>!o))return showToast("Барлық өрісті толтырыңыз","err");
    setQs(p=>[...p,{id:Date.now(),...cur}]);
    setCur({q:"",opts:["","","",""],ans:0,exp:""});
    showToast("Сұрақ кезекке қосылды");
  };
  const saveAll=()=>{
    if(!lid)return showToast("Сабақты таңдаңыз","err");
    if(!qs.length)return showToast("Кем дегенде 1 жаңа сұрақ қосыңыз","err");
    setContent(p=>({...p,[storeKey]:{...(p[storeKey]||{}),[lid]:[...existing,...qs]}}));
    showToast(label+" сақталды ✅");
    setQs([]);
  };
  const delQ=(id,fromStore)=>{
    if(fromStore){setContent(p=>({...p,[storeKey]:{...(p[storeKey]||{}),[lid]:existing.filter(q=>q.id!==id)}}));}
    else setQs(p=>p.filter(q=>q.id!==id));
    showToast("Жойылды","err");
  };
  const clearAll=()=>{
    if(!lid)return;
    setContent(p=>({...p,[storeKey]:{...(p[storeKey]||{}),[lid]:[]}}));
    showToast("Барлық сұрақ жойылды","err");
  };

  return(
    <div style={{...GC.card,padding:20,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,cursor:"pointer"}} onClick={()=>setOpen(p=>!p)}>
        <div style={{fontWeight:800,fontSize:15}}>{label}</div>
        <span style={{color:"#9CA3AF",fontSize:18,transform:open?"rotate(90deg)":"",transition:"all 0.2s"}}>›</span>
      </div>
      {open&&(
        <div>
          {/* Subject + Lesson select */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:10,marginBottom:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Пән</label>
              <select value={sid} onChange={e=>{setSid(e.target.value);setLid("");}} style={inp}>
                {SUBJECTS.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:"#6B7280",display:"block",marginBottom:4}}>Сабақ</label>
              <select value={lid} onChange={e=>setLid(e.target.value)} style={inp}>
                <option value="">Таңдаңыз...</option>
                {lessons.map(l=><option key={l.id} value={l.id}>{l.topicTitle} → {l.title}</option>)}
              </select>
            </div>
          </div>

          {/* Count config */}
          {lid&&(
            <div style={{background:"#EEF2FF",borderRadius:12,padding:"10px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontWeight:700,fontSize:13,flex:1}}>
                {label} сұрақ саны: <b style={{color:"#4F46E5",fontSize:16}}>{thisCount}</b>
              </div>
              <input type="range" min={mode==="hw"?5:3} max={mode==="hw"?25:20} value={thisCount}
                onChange={e=>setContent(p=>({...p,[countKey]:{...(p[countKey]||{}),[lid]:+e.target.value}}))}
                style={{flex:1,accentColor:"#4F46E5"}}/>
              <div style={{fontSize:11,color:"#6B7280",flexShrink:0}}>{mode==="hw"?"5–25":"3–20"}</div>
            </div>
          )}

          {/* Existing questions */}
          {lid&&existing.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:13,color:"#6B7280"}}>Қосылған сұрақтар ({existing.length})</div>
                <button onClick={clearAll} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"4px 10px",fontSize:11,fontWeight:700}}>🗑 Барлығын жою</button>
              </div>
              {existing.map((q,i)=>(
                <div key={q.id} style={{background:"#FAFAFE",borderRadius:10,padding:"10px 14px",marginBottom:6,border:"1px solid #EEF0FF",display:"flex",gap:8,alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:12}}>{i+1}. {q.q}</div>
                    <div style={{fontSize:11,color:"#22C55E",marginTop:2}}>✓ {q.opts[q.ans]}</div>
                    {q.exp&&<div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>💡 <Rich text={q.exp}/></div>}
                  </div>
                  <button onClick={()=>delQ(q.id,true)} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"4px 8px",fontSize:11,flexShrink:0}}>🗑</button>
                </div>
              ))}
            </div>
          )}

          {/* Add new question */}
          <div style={{background:"#F8FAFF",borderRadius:14,padding:16,border:"2px dashed #C7D2FE"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:10,color:"#4F46E5"}}>+ Жаңа сұрақ</div>
            <textarea value={cur.q} onChange={e=>setCur(p=>({...p,q:e.target.value}))}
              style={{...inp,height:60,resize:"none",marginBottom:10}} placeholder="Сұрақ мәтіні..."/>
            {["A","B","C","D"].map((lbl,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                <div onClick={()=>setCur(p=>({...p,ans:i}))} style={{width:34,height:34,borderRadius:8,
                  background:cur.ans===i?"#4F46E5":"#EEF0FF",display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:900,fontSize:13,color:cur.ans===i?"#fff":"#6B7280",cursor:"pointer",flexShrink:0}}>{lbl}</div>
                <input value={cur.opts[i]} onChange={e=>{const o=[...cur.opts];o[i]=e.target.value;setCur(p=>({...p,opts:o}))}}
                  style={inp} placeholder={`${lbl} жауабы...`}/>
              </div>
            ))}
            <input value={cur.exp} onChange={e=>setCur(p=>({...p,exp:e.target.value}))}
              style={{...inp,marginBottom:10}} placeholder="Түсіндірме (міндетті емес)..."/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...GC.btn,background:"#EEF2FF",color:"#4F46E5",flex:1,padding:10,fontWeight:700}} onClick={addQ}>+ Кезекке қосу</button>
              {qs.length>0&&<button style={{...GC.btn,...GC.pri,flex:1,padding:10,fontWeight:700}} onClick={saveAll}>💾 {qs.length} сұрақты сақтау</button>}
            </div>
            {qs.length>0&&(
              <div style={{marginTop:10}}>
                {qs.map((q,i)=>(
                  <div key={q.id} style={{background:"#FFFBEB",borderRadius:8,padding:"8px 12px",marginBottom:4,border:"1px solid #FCD34D",display:"flex",justifyContent:"space-between",gap:8}}>
                    <div style={{fontSize:11,flex:1}}><b>{i+1}.</b> {q.q} — <span style={{color:"#22C55E"}}>✓ {q.opts[q.ans]}</span></div>
                    <button onClick={()=>delQ(q.id,false)} style={{...GC.btn,background:"#FEF2F2",color:"#EF4444",padding:"2px 7px",fontSize:11,flexShrink:0}}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   ADMIN: LESSON KONSPEKT / ERROR WORK (Video+PDF per lesson)
════════════════════════════════════════════════════════ */
function AdminLessonMedia({mode,content,setContent,showToast}){
  const isError=mode==="error";
  const storeKey=isError?"lessonErrorWork":"lessonPdfs";
  const titleLabel=isError?"🔄 Қатемен жұмыс — видео/PDF (сабақ бойынша)":"📄 Конспект PDF (сабақ бойынша)";
  const [sid,setSid]=useState(SUBJECTS[0].id);
  const [open,setOpen]=useState(false);
  const tops=content.topics?.[sid]||[];
  const lessons=tops.flatMap(t=>(t.lessons||[]).map(l=>({...l,topicTitle:t.title})));
  return(
    <div style={{...GC.card,padding:20,marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:open?14:0,cursor:"pointer"}} onClick={()=>setOpen(p=>!p)}>
        <div style={{fontWeight:800,fontSize:15}}>{titleLabel}</div>
        <span style={{color:"#9CA3AF",fontSize:18,transform:open?"rotate(90deg)":"",transition:"all 0.2s"}}>›</span>
      </div>
      {open&&(
        <div>
          <select value={sid} onChange={e=>setSid(e.target.value)} style={{...GC.input,marginBottom:14}}>
            {SUBJECTS.map(s=><option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {lessons.map(l=>{
              const item=content[storeKey]?.[l.id]||{videoUrl:"",pdfUrl:""};
              const hasContent=item.videoUrl||item.pdfUrl;
              return(
                <div key={l.id} style={{background:"#FAFAFE",borderRadius:12,padding:14,border:`1px solid ${hasContent?"#86EFAC":"#EEF0FF"}`}}>
                  <div style={{fontWeight:700,fontSize:12,marginBottom:10,color:hasContent?"#22C55E":"#6B7280"}}>
                    {hasContent?"✅":"📝"} {l.topicTitle} → {l.title}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:8}}>
                    {isError&&(
                      <div>
                        <label style={{fontSize:11,color:"#9CA3AF",display:"block",marginBottom:3}}>▶ Видео URL (YouTube/Drive)</label>
                        <input defaultValue={item.videoUrl} placeholder="https://youtube.com/..."
                          style={{...GC.input,fontSize:12}}
                          onBlur={e=>{const v=e.target.value.trim();
                            setContent(p=>({...p,[storeKey]:{...(p[storeKey]||{}),[l.id]:{...(p[storeKey]?.[l.id]||{}),videoUrl:v}}}));
                            if(v)showToast("Видео сақталды ✅");}}/>
                      </div>
                    )}
                    <div>
                      <label style={{fontSize:11,color:"#9CA3AF",display:"block",marginBottom:3}}>📄 PDF URL (Google Drive)</label>
                      <input defaultValue={item.pdfUrl} placeholder="https://drive.google.com/..."
                        style={{...GC.input,fontSize:12}}
                        onBlur={e=>{const v=e.target.value.trim();
                          setContent(p=>({...p,[storeKey]:{...(p[storeKey]||{}),[l.id]:{...(p[storeKey]?.[l.id]||{}),pdfUrl:v}}}));
                          if(v)showToast("PDF сақталды ✅");}}/>
                    </div>
                  </div>
                </div>
              );
            })}
            {lessons.length===0&&<div style={{color:"#9CA3AF",fontSize:13,textAlign:"center",padding:16}}>Пәнге сабақ қосылмаған</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   PAYMENT MODAL
════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════
   ADD STUDENT MODAL — standalone to prevent focus loss
════════════════════════════════════════════════════════ */
/* ══ CERTIFICATE MODAL ══ */
function CertificateModal({result, user, onClose}){
  const score = result?.score||0;
  const grade = score>=90?"A (Өте жақсы)":score>=75?"B (Жақсы)":score>=60?"C (Қанағаттанарлық)":"D";
  const printCert = ()=>{
    const w = window.open('','_blank','width=800,height=600');
    w.document.write(`<!DOCTYPE html><html><head><title>Сертификат</title>
    <style>body{font-family:serif;margin:0;padding:40px;background:#fff;}
    .cert{border:8px double #4F46E5;padding:40px;text-align:center;min-height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
    h1{color:#4F46E5;font-size:36px;margin-bottom:8px;}
    .name{font-size:28px;font-weight:bold;color:#1E1B4B;margin:20px 0;border-bottom:2px solid #4F46E5;padding-bottom:10px;}
    .score{font-size:72px;font-weight:900;color:#22C55E;line-height:1;}
    .sub{font-size:18px;color:#6B7280;margin:10px 0;}
    .date{font-size:14px;color:#9CA3AF;margin-top:20px;}
    .grade{font-size:22px;font-weight:bold;color:#4F46E5;margin:10px 0;}
    </style></head><body>
    <div class="cert">
      <div style="font-size:48px;">🏅</div>
      <h1>СЕРТИФИКАТ</h1>
      <p style="color:#6B7280;">Бұл сертификат мынаған тапсырылады:</p>
      <div class="name">${user?.name||"Оқушы"}</div>
      <p class="sub">${result?.subjectName||"Тест"} пәні бойынша тест тапсырды</p>
      <div class="score">${score}%</div>
      <div class="grade">${grade}</div>
      <div class="date">${result?.date||new Date().toLocaleDateString("kk-KZ")} • Smart UBT Platform</div>
    </div>
    <script>window.print();window.close();</script>
    </body></html>`);
    w.document.close();
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:24,width:"100%",maxWidth:440,padding:32,textAlign:"center",border:"6px double #4F46E5"}}>
        <div style={{fontSize:64,marginBottom:8}}>🏅</div>
        <h2 style={{fontWeight:900,fontSize:22,color:"#4F46E5",marginBottom:4}}>СЕРТИФИКАТ</h2>
        <p style={{color:"#6B7280",marginBottom:16}}>Бұл сертификат мынаған тапсырылады:</p>
        <div style={{fontWeight:900,fontSize:20,color:"#1E1B4B",borderBottom:"2px solid #4F46E5",paddingBottom:12,marginBottom:12}}>{user?.name}</div>
        <p style={{color:"#6B7280",fontSize:14,marginBottom:8}}>{result?.subjectName} пәні бойынша тест тапсырды</p>
        <div style={{fontSize:64,fontWeight:900,color:"#22C55E",lineHeight:1}}>{score}%</div>
        <div style={{fontSize:18,fontWeight:700,color:"#4F46E5",margin:"8px 0"}}>{grade}</div>
        <div style={{fontSize:12,color:"#9CA3AF",marginBottom:20}}>{result?.date} • Smart UBT Platform</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onClose} style={{flex:1,minWidth:80,padding:"10px",borderRadius:12,border:"1px solid #EEF0FF",background:"#F9FAFB",cursor:"pointer",fontWeight:700}}>Жабу</button>
          <button onClick={printCert} style={{flex:2,minWidth:120,padding:"10px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",cursor:"pointer",fontWeight:800}}>🖨️ Басып шығару / Сақтау</button>
          <button onClick={()=>{
            const txt=`🏅 Smart UBT Platform сертификаты!
👤 ${user?.name}
📚 ${result?.subjectName}
✅ ${score}% (${result?.grade||grade})
📅 ${result?.date}

#SmartUBT #ҰБТ #Qazaqstan`;
            window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");
          }} style={{width:"100%",padding:"10px",borderRadius:12,border:"none",background:"#25D366",color:"#fff",cursor:"pointer",fontWeight:800,marginTop:4}}>📤 WhatsApp-та бөлісу</button>
        </div>
      </div>
    </div>
  );
}

/* ══ REPORT QUESTION MODAL ══ */
function ReportQuestionModal({data, onClose, onReport}){
  const [reason, setReason] = React.useState("");
  const [type, setType] = React.useState("wrong_answer");
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:700,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:420,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{fontWeight:800,fontSize:16,color:"#1E1B4B",margin:0}}>⚠️ Сұрақты хабарлау</h3>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"#6B7280"}}>✕</button>
        </div>
        <div style={{background:"#FEF9C3",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"#92400E"}}>
          {data?.q?.slice(0,100)}...
        </div>
        <div style={{marginBottom:12}}>
          {[["wrong_answer","Жауап қате"],["unclear","Сұрақ түсініксіз"],["typo","Жазу қатесі"],["other","Басқа"]].map(([v,l])=>(
            <label key={v} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",cursor:"pointer"}}>
              <input type="radio" name="rtype" value={v} checked={type===v} onChange={()=>setType(v)} style={{accentColor:"#4F46E5"}}/>
              <span style={{fontSize:14,color:"#374151"}}>{l}</span>
            </label>
          ))}
        </div>
        <textarea value={reason} onChange={e=>setReason(e.target.value)}
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #E5E7EB",fontSize:14,resize:"none",height:80,marginBottom:14,boxSizing:"border-box"}}
          placeholder="Қосымша түсінік (міндетті емес)"/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid #EEF0FF",background:"#F9FAFB",cursor:"pointer",fontWeight:700}}>Бас тарту</button>
          <button onClick={()=>{onReport({...data,type,reason});onClose();}} style={{flex:2,padding:"10px",borderRadius:10,border:"none",background:"#EF4444",color:"#fff",cursor:"pointer",fontWeight:800}}>📨 Жіберу</button>
        </div>
      </div>
    </div>
  );
}


function AddStudentModal({onClose,onSave,users,SUBJECTS,C}){
  const [ns,setNs]=React.useState({name:"",email:"",password:"",phone:"",plan:"free",subjects:[]});
  const inp={...C.input,marginBottom:10};
  const save=()=>{
    if(!ns.name.trim()||!ns.email.trim())return;
    if(users.find(u=>u.email===ns.email)){alert("Бұл email тіркелген");return;}
    onSave({
      id:Date.now(),name:ns.name.trim(),email:ns.email.trim(),
      password:ns.password||"1234",phone:ns.phone,plan:ns.plan,
      subjects:ns.subjects,role:"student",streak:0,xp:0,
      avatar:"👤",createdAt:new Date().toLocaleDateString("kk-KZ"),
      progress:{},scores:[],status:"active",
    });
  };
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:"clamp(8px,3vw,16px)",overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:"min(480px,100%)",padding:"clamp(16px,5vw,28px)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontWeight:900,fontSize:18,color:"#1E1B4B",margin:0}}>👤 Жаңа оқушы қосу</h2>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontSize:14,color:"#6B7280"}}>✕</button>
        </div>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:4,letterSpacing:1}}>АТЫ-ЖӨНІ *</label>
        <input value={ns.name} onChange={e=>setNs(p=>({...p,name:e.target.value}))} style={inp} placeholder="Оқушының аты-жөні"/>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:4,letterSpacing:1}}>EMAIL *</label>
        <input value={ns.email} onChange={e=>setNs(p=>({...p,email:e.target.value}))} style={inp} placeholder="email@mail.com"/>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:4,letterSpacing:1}}>ТЕЛЕФОН</label>
        <input value={ns.phone} onChange={e=>setNs(p=>({...p,phone:e.target.value}))} style={inp} placeholder="+7 777 XXX XX XX"/>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:4,letterSpacing:1}}>ҚҰПИЯСӨЗ (бос қалса: 1234)</label>
        <input value={ns.password} onChange={e=>setNs(p=>({...p,password:e.target.value}))} style={{...inp,marginBottom:14}} placeholder="Құпиясөз"/>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:8,letterSpacing:1}}>ЖОСПАР</label>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          {[["free","🆓 Тегін","#F3F4F6","#6B7280"],["premium","⭐ Премиум","#DCFCE7","#16A34A"]].map(([val,lbl,bg,col])=>(
            <div key={val} onClick={()=>setNs(p=>({...p,plan:val}))}
              style={{flex:1,padding:"10px",borderRadius:12,cursor:"pointer",textAlign:"center",fontWeight:700,fontSize:13,
                background:ns.plan===val?bg:"#F9FAFB",color:ns.plan===val?col:"#9CA3AF",
                border:`2px solid ${ns.plan===val?col:"#EEF0FF"}`}}>
              {lbl}
            </div>
          ))}
        </div>
        <label style={{fontSize:11,fontWeight:700,color:"#9CA3AF",display:"block",marginBottom:8,letterSpacing:1}}>ПӘНДЕР ТАҢДА</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:18}}>
          {SUBJECTS.map(s=>{
            const sel=ns.subjects.includes(s.id);
            return(
              <div key={s.id} onClick={()=>setNs(p=>({...p,subjects:sel?p.subjects.filter(x=>x!==s.id):[...p.subjects,s.id]}))}
                style={{padding:"7px 6px",borderRadius:10,cursor:"pointer",textAlign:"center",fontSize:11,fontWeight:700,
                  background:sel?s.bg:"#F9FAFB",color:sel?s.color:"#9CA3AF",border:`1px solid ${sel?s.color:"#EEF0FF"}`}}>
                {s.icon} {s.name.length>10?s.name.slice(0,9)+"…":s.name}
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{...C.btn,...C.sec,flex:1,padding:12}}>Бас тарту</button>
          <button onClick={save} style={{...C.btn,...C.pri,flex:2,padding:12,fontWeight:800}}>✅ Қосу</button>
        </div>
      </div>
    </div>
  );
}



function AddStaffForm({users,setUsers,showToast,C}){
  const [ns,setNs]=React.useState({name:"",email:"",password:"admin",role:"curator",phone:""});
  return(
    <div>
      <input value={ns.name} onChange={e=>setNs(p=>({...p,name:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Аты-жөні"/>
      <input value={ns.email} onChange={e=>setNs(p=>({...p,email:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Email"/>
      <input value={ns.phone} onChange={e=>setNs(p=>({...p,phone:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Телефон (міндетті емес)"/>
      <input value={ns.password} onChange={e=>setNs(p=>({...p,password:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Құпиясөз"/>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[["curator","👩‍🏫 Куратор","#0EA5E9"],["admin","⚙️ Адмін","#1E1B4B"]].map(([val,lbl,col])=>(
          <div key={val} onClick={()=>setNs(p=>({...p,role:val}))}
            style={{flex:1,padding:"10px",borderRadius:12,cursor:"pointer",textAlign:"center",fontWeight:700,fontSize:13,
              background:ns.role===val?col:"#F9FAFB",color:ns.role===val?"#fff":"#9CA3AF",
              border:`2px solid ${ns.role===val?col:"#EEF0FF"}`}}>
            {lbl}
          </div>
        ))}
      </div>
      <button onClick={()=>{
        if(!ns.name||!ns.email)return showToast("Аты мен email міндетті","err");
        if(users.find(u=>u.email===ns.email))return showToast("Бұл email тіркелген","err");
        const newStaff={id:Date.now(),name:ns.name.trim(),email:ns.email.trim(),
          password:ns.password||"admin",phone:ns.phone,role:ns.role,plan:"premium",
          subjects:[],streak:0,xp:0,avatar:ns.role==="curator"?"👩‍🏫":"⚙️",
          createdAt:new Date().toLocaleDateString("kk-KZ"),status:"active"};
        setUsers(p=>[...p,newStaff]);
        showToast(ns.name+" қосылды ✅");
        setNs({name:"",email:"",password:"admin",role:"curator",phone:""});
      }} style={{...C.btn,...C.pri,width:"100%",padding:12,fontWeight:800}}>
        ✅ Қызметкер қосу
      </button>
    </div>
  );
}


// Деректемелі (seed) араластыру — бір сұрақ үшін әр рендерде бірдей рет шығады, бірақ сұрақтар арасында әртүрлі
const seededShuffle=(arr,seed)=>{
  let h=0;
  const s=String(seed);
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    h=(Math.imul(h,1103515245)+12345)|0;
    const j=Math.abs(h)%(i+1);
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
};

// ── Жеңіл Markdown рендерер (сабақ теориясы үшін: #### / ### тақырыпша, **қалың**, - тізім, 1. нөмірленген тізім) ──
// ── Курс көмекшілері ──
const REVIEW_PASS=50; // тарау тесті «өтілді» деп саналатын пайыз
const isReviewId=id=>String(id).endsWith("_review");
function toEmbedUrl(u){
  const url=String(u||"").trim();
  if(!url)return "";
  let m=url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if(m)return "https://www.youtube.com/embed/"+m[1]+"?rel=0";
  m=url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m)return "https://player.vimeo.com/video/"+m[1];
  m=url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if(m)return "https://drive.google.com/file/d/"+m[1]+"/preview";
  return /^https:\/\//i.test(url)?url:"";
}
// Видео сілтемелері мен «тегін сабақ» белгісі серверде сақталады (lesson_media кестесі) — барлық оқушыға бірдей көрінеді
async function sbFetchLessonMedia(){
  const map={};
  try{const r=await fetch("/content/videos.json");if(r.ok){const d=await r.json();Object.keys(d||{}).forEach(k=>{map[k]={video_url:d[k].video_url||"",is_free:!!d[k].is_free};});}}catch(e){}
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/lesson_media?select=lesson_id,video_url,is_free",{headers:sbHeaders()});
    if(!res.ok)return Object.keys(map).length?map:null;
    const rows=await res.json();
    rows.forEach(r=>{map[r.lesson_id]={video_url:r.video_url||"",is_free:!!r.is_free};});
    return map;
  }catch(e){return Object.keys(map).length?map:null;}
}
async function sbSetLessonMedia(email,password,lessonId,videoUrl,isFree){
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/rpc/admin_set_lesson_media",{method:"POST",headers:sbHeaders(),
      body:JSON.stringify({p_email:email,p_password:password,p_lesson_id:lessonId,p_video_url:videoUrl||"",p_is_free:!!isFree})});
    if(!res.ok)return {ok:false,error:"http_"+res.status};
    const ok=(await res.json())===true;
    return {ok,error:ok?null:"denied"};
  }catch(e){return {ok:false,error:"network"};}
}

// ── Админ: видео сілтемелері мен «тегін сабақ» белгісі (серверде сақталады) ──
let VIDEO_ADMIN_PW="";  // тек жад ішінде, браузерде сақталмайды
function VideoAdminPanel({chapters,lessonMedia,setLessonMedia,user,showToast,C}){
  const [openId,setOpenId]=React.useState(chapters[0]?.id);
  const [drafts,setDrafts]=React.useState({});
  const [pw,setPw]=React.useState(VIDEO_ADMIN_PW);
  const [busy,setBusy]=React.useState(null);
  const [q,setQ]=React.useState("");
  const cur=(id)=>drafts[id]??{url:lessonMedia[id]?.video_url||"",free:!!lessonMedia[id]?.is_free};
  const dirty=(id)=>{const d=drafts[id];if(!d)return false;return d.url.trim()!==(lessonMedia[id]?.video_url||"")||d.free!==!!lessonMedia[id]?.is_free;};
  const all=chapters.flatMap(c=>c.lessons).filter(l=>!isReviewId(l.id));
  const withVideo=all.filter(l=>lessonMedia[l.id]?.video_url).length;
  const save=async(ls)=>{
    if(!pw)return showToast("Алдымен жоғарыда админ парольін енгізіңіз","err");
    const d=cur(ls.id);
    if(d.url.trim()&&!/^https:\/\//i.test(d.url.trim()))return showToast("Сілтеме https:// деп басталуы керек","err");
    setBusy(ls.id);
    const r=await sbSetLessonMedia(user.email,pw,ls.id,d.url.trim(),d.free);
    setBusy(null);
    if(r.ok){
      VIDEO_ADMIN_PW=pw;
      setLessonMedia(m=>{const n={...m,[ls.id]:{video_url:d.url.trim(),is_free:d.free}};sS("ubt3_media",n);return n;});
      setDrafts(x=>{const y={...x};delete y[ls.id];return y;});
      showToast("Сақталды ✅");
    }else{
      showToast(r.error==="denied"?"Пароль қате немесе админ құқығы жоқ":r.error==="network"?"Серверге қосыла алмадық":"Сервер қатесі ("+r.error+")","err");
    }
  };
  const ql=q.trim().toLowerCase();
  return(
    <div>
      <div style={{...C.card,padding:20,marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:17,marginBottom:6}}>🎬 Видео сілтемелері</div>
        <p style={{color:"#6B7280",fontSize:13,lineHeight:1.6,marginBottom:12}}>
          Видеоны YouTube («Сілтемесі бар» режимінде), Vimeo немесе Google Drive-қа жүктеп, сілтемесін сабақ жанына қойып, <b>Сақтау</b> басыңыз.
          Сілтеме барлық оқушыға бірден көрінеді. Қосылған: <b>{withVideo}/{all.length}</b>
        </p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <input type="password" autoComplete="current-password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Админ паролі (сақтау үшін, бір рет)" style={{...C.input,flex:"1 1 220px"}}/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Сабақты іздеу (мысалы: §12)" style={{...C.input,flex:"1 1 220px"}}/>
        </div>
      </div>
      {chapters.map(ch=>{
        const ls=ch.lessons.filter(l=>!isReviewId(l.id)).filter(l=>!ql||l.title.toLowerCase().includes(ql));
        if(ql&&!ls.length)return null;
        const isOpen=ql||openId===ch.id;
        const have=ch.lessons.filter(l=>!isReviewId(l.id)&&lessonMedia[l.id]?.video_url).length;
        const tot=ch.lessons.filter(l=>!isReviewId(l.id)).length;
        return(
          <div key={ch.id} style={{...C.card,marginBottom:10,overflow:"hidden"}}>
            <div onClick={()=>setOpenId(isOpen&&!ql?null:ch.id)} style={{padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",gap:10}}>
              <div style={{fontWeight:800,fontSize:14}}>{ch.title}</div>
              <div style={{fontSize:12,fontWeight:800,color:have===tot?"#16A34A":"#6B7280",flexShrink:0}}>{have}/{tot} 🎬 {isOpen?"▲":"▼"}</div>
            </div>
            {isOpen&&ls.map(l=>{
              const d=cur(l.id);const has=!!lessonMedia[l.id]?.video_url;
              return(
                <div key={l.id} style={{padding:"12px 18px",borderTop:"1px solid #EEF0FF"}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{has?"🟢":"⚪"} {l.title}</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <input value={d.url} onChange={e=>setDrafts(x=>({...x,[l.id]:{...cur(l.id),url:e.target.value}}))} placeholder="https://youtu.be/... немесе Vimeo / Google Drive" style={{...C.input,flex:"1 1 260px"}}/>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                      <input type="checkbox" checked={d.free} onChange={e=>setDrafts(x=>({...x,[l.id]:{...cur(l.id),free:e.target.checked}}))}/> Тегін
                    </label>
                    <button disabled={!dirty(l.id)||busy===l.id} onClick={()=>save(l)} style={{...C.btn,...C.pri,padding:"9px 16px",fontSize:12,opacity:dirty(l.id)?1:0.4}}>{busy===l.id?"...":"Сақтау"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Анықтамалық кестелер (тест кезінде ашылады): Менделеев, ерігіштік, металдар қатары ──
const EL_CAT=(z)=>{
  if([3,11,19,37,55,87].includes(z))return "alk";
  if([4,12,20,38,56,88].includes(z))return "alke";
  if([2,10,18,36,54,86,118].includes(z))return "noble";
  if([9,17,35,53,85,117].includes(z))return "hal";
  if([5,14,32,33,51,52].includes(z))return "meta";
  if([1,6,7,8,15,16,34].includes(z))return "non";
  if(z>=57&&z<=71)return "lan";
  if(z>=89&&z<=103)return "act";
  if([13,31,49,50,81,82,83,84,113,114,115,116].includes(z))return "post";
  return "tr";
};
const EL_COL={alk:"#FCA5A5",alke:"#FDBA74",tr:"#FDE68A",post:"#BEF264",meta:"#99F6E4",non:"#93C5FD",hal:"#C4B5FD",noble:"#F9A8D4",lan:"#A5B4FC",act:"#D8B4FE"};
const EL_CAT_NAME={alk:"Сілтілік металдар",alke:"Сілтілік-жер металдар",tr:"Өтпелі металдар",post:"Өтпелі соңғы металдар",meta:"Жартылай металдар",non:"Бейметалдар",hal:"Галогендер",noble:"Инертті газдар",lan:"Лантаноидтар",act:"Актиноидтар"};
function elPos(z){
  if(z===1)return [1,1];if(z===2)return [1,18];
  if(z<=4)return [2,z-2];if(z<=10)return [2,z+8];
  if(z<=12)return [3,z-10];if(z<=18)return [3,z];
  if(z<=36)return [4,z-18];if(z<=54)return [5,z-36];
  if(z<=56)return [6,z-54];if(z===57)return [6,3];
  if(z<=71)return [8,z-54];            // лантаноидтар қатары: 4..17 баған
  if(z<=86)return [6,z-68];
  if(z<=88)return [7,z-86];if(z===89)return [7,3];
  if(z<=103)return [9,z-86];           // актиноидтар қатары
  return [7,z-100];
}
function RefTables({onClose}){
  const [tab,setTab]=React.useState("pt");
  const [sel,setSel]=React.useState(null);
  const tabs=[["pt","Менделеев кестесі"],["sol","Ерігіштік кестесі"],["ser","Металдар қатары"]];
  const solColor={"Р":"#16A34A","М":"#D97706","Н":"#DC2626","—":"#9CA3AF"};
  const e=sel?ELEMENTS[sel-1]:null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:10}}>
      <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:18,width:"min(1100px,100%)",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(0,0,0,0.35)",color:"#1E1B4B"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",borderBottom:"1px solid #E5E7EB",flexWrap:"wrap"}}>
          {tabs.map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{border:"none",borderRadius:10,padding:"8px 12px",fontWeight:800,fontSize:13,cursor:"pointer",background:tab===id?"#4F46E5":"#EEF2FF",color:tab===id?"#fff":"#4338CA"}}>{l}</button>
          ))}
          <button onClick={onClose} aria-label="Жабу" style={{marginLeft:"auto",border:"none",background:"#F3F4F6",borderRadius:10,width:36,height:36,fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{overflow:"auto",padding:14}}>
          {tab==="pt"&&(
            <div>
              <div style={{minHeight:44,marginBottom:10,padding:"8px 12px",borderRadius:10,background:"#F8FAFF",border:"1px solid #E5E7EB",fontSize:14,fontWeight:700}}>
                {e?<span>№{e[0]} · <b style={{fontSize:18}}>{e[1]}</b> — {e[2]} · атомдық масса: {e[3]} · {EL_CAT_NAME[EL_CAT(e[0])]}</span>:<span style={{color:"#9CA3AF",fontWeight:600}}>Элементті басыңыз: атауы мен массасы осында көрінеді</span>}
              </div>
              <div style={{overflowX:"auto"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(18,minmax(44px,1fr))",gridTemplateRows:"repeat(7,auto) 14px repeat(2,auto)",gap:3,minWidth:840}}>
                  {ELEMENTS.map(([z,sym,nm,mass])=>{
                    const [r,c]=elPos(z);const cat=EL_CAT(z);
                    return(
                      <button key={z} onClick={()=>setSel(z)} title={nm} style={{gridRow:r>7?r+1:r,gridColumn:c,border:sel===z?"2px solid #4F46E5":"1px solid rgba(0,0,0,0.12)",background:EL_COL[cat],borderRadius:6,padding:"2px 2px",cursor:"pointer",textAlign:"center",lineHeight:1.1,color:"#1E1B4B"}}>
                        <div style={{fontSize:8,textAlign:"left",opacity:0.7}}>{z}</div>
                        <div style={{fontSize:15,fontWeight:900}}>{sym}</div>
                        <div style={{fontSize:8,opacity:0.8}}>{mass}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12,fontSize:11}}>
                {Object.keys(EL_COL).map(k=><span key={k} style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:12,height:12,borderRadius:3,background:EL_COL[k],border:"1px solid rgba(0,0,0,0.15)"}}/>{EL_CAT_NAME[k]}</span>)}
              </div>
            </div>
          )}
          {tab==="sol"&&(
            <div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",minWidth:560,width:"100%",fontSize:14,textAlign:"center"}}>
                  <thead><tr><th style={{padding:8,border:"1px solid #E5E7EB",background:"#F3F4F6"}}></th>{SOL_ANIONS.map(a=><th key={a} style={{padding:"8px 6px",border:"1px solid #E5E7EB",background:"#EEF2FF",fontWeight:800}}>{a}</th>)}</tr></thead>
                  <tbody>{SOL_ROWS.map(([c,cells])=>(
                    <tr key={c}><td style={{padding:"7px 8px",border:"1px solid #E5E7EB",background:"#FEF3C7",fontWeight:800}}>{c}</td>
                      {cells.map((v,i)=><td key={i} style={{padding:"7px 6px",border:"1px solid #E5E7EB",fontWeight:900,color:solColor[v]}}>{v}</td>)}
                    </tr>))}</tbody>
                </table>
              </div>
              <div style={{marginTop:12,fontSize:13,lineHeight:1.8}}>
                <b style={{color:"#16A34A"}}>Р</b> — суда жақсы ериді · <b style={{color:"#D97706"}}>М</b> — аз ериді · <b style={{color:"#DC2626"}}>Н</b> — іс жүзінде ерімейді · <b style={{color:"#9CA3AF"}}>—</b> — суда ыдырайды немесе жоқ
              </div>
              <div style={{marginTop:6,fontSize:12,color:"#6B7280"}}>Кесте қысқартылған: негізгі катиондар мен аниондар ғана берілген.</div>
            </div>
          )}
          {tab==="ser"&&(
            <div>
              <div style={{fontWeight:800,marginBottom:10}}>Металдардың кернеу қатары (активтілігі солдан оңға қарай кемиді)</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
                {METAL_SERIES.map((m,i)=>(
                  <React.Fragment key={m}>
                    <span style={{padding:"8px 11px",borderRadius:10,fontWeight:900,fontSize:16,background:m==="H"?"#DBEAFE":i<METAL_SERIES.indexOf("H")?"#FEE2E2":"#E0F2FE",border:m==="H"?"2px solid #3B82F6":"1px solid rgba(0,0,0,0.1)"}}>{m}</span>
                    {i<METAL_SERIES.length-1&&<span style={{color:"#9CA3AF"}}>›</span>}
                  </React.Fragment>
                ))}
              </div>
              <div style={{marginTop:14,fontSize:13,lineHeight:1.8,color:"#374151"}}>
                Сутектен солға тұрған металдар сұйылтылған қышқылдардан сутекті ығыстырады. Әр металл өзінен кейін тұрған металды тұздарының ерітіндісінен ығыстырады.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Серверлік режим: кіру, теория, тест және активация сервер арқылы ──
let APP_TOKEN=gS("ubt3_token","");
const THEORY_CACHE={};
const setAppToken=(t)=>{APP_TOKEN=t||"";sS("ubt3_token",t||"");Object.keys(THEORY_CACHE).forEach(k=>delete THEORY_CACHE[k]);};
async function sbRpc(name,args){
  try{
    const res=await fetch(SUPABASE_URL+"/rest/v1/rpc/"+name,{method:"POST",headers:sbHeaders(),body:JSON.stringify(args||{})});
    if(!res.ok)return {ok:false,error:"http_"+res.status};
    return {ok:true,data:await res.json()};
  }catch(e){return {ok:false,error:"network"};}
}
// Серверден келген қолданушы: рөл мен тариф тек сервер мәні; XP, прогресс жергілікті сақталады
const fromServerUser=(row,local)=>({
  ...(local||{}),
  id:row.id,email:row.email,name:row.name||local?.name||"",phone:row.phone||"",grade:row.grade||local?.grade||"11",
  role:row.role||"student",plan:row.plan||"free",
  subjects:(row.subjects&&row.subjects.length)?row.subjects:(local?.subjects||["chemistry"]),
  status:row.status||"active",avatar:local?.avatar||row.avatar||"🧑‍🎓",
  xp:local?.xp??row.xp??0,streak:local?.streak??row.streak??0,
  progress:local?.progress||{},scores:local?.scores||[],studyPlan:local?.studyPlan||null,
  createdAt:local?.createdAt||(row.created_at?new Date(row.created_at).toLocaleDateString("kk-KZ"):""),
  password:"",unlockCode:undefined,
});

// ── Админ: активация коды және тариф беру (серверде) ──
function ActivationAdminPanel({showToast,C,users}){
  const [email,setEmail]=React.useState("");
  const [plan,setPlan]=React.useState("premium");
  const [res,setRes]=React.useState(null);
  const [busy,setBusy]=React.useState(false);
  const call=async(fn,args,onOk)=>{
    setBusy(true);const r=await sbRpc(fn,{p_token:APP_TOKEN,...args});setBusy(false);
    if(!r.ok)return showToast(r.error==="network"?"Серверге қосыла алмадық":"Сервер қатесі ("+r.error+")","err");
    if(r.data?.error)return showToast(r.data.error==="denied"?"Админ құқығы жоқ":r.data.error==="user"?"Мұндай email-мен оқушы табылмады":"Қате: "+r.data.error,"err");
    onOk(r.data);
  };
  const em=email.trim().toLowerCase();
  return(
    <div style={{...C.card,padding:22,maxWidth:560}}>
      <div style={{fontWeight:900,fontSize:17,marginBottom:6}}>🔑 Активация коды</div>
      <p style={{color:"#6B7280",fontSize:13,lineHeight:1.6,marginBottom:14}}>Оқушы төлем жасап, чекті жібергеннен кейін оның email-ін жазып, код жасаңыз. Кодты оқушыға WhatsApp арқылы жіберіңіз. Код бір рет қана жұмыс істейді және тек сол оқушыға арналған.</p>
      <input value={email} onChange={e=>{setEmail(e.target.value);setRes(null);}} placeholder="Оқушының email-і" list="ub-students" style={{...C.input,marginBottom:10}}/>
      <datalist id="ub-students">{(users||[]).filter(u=>u.role==="student").slice(0,300).map(u=><option key={u.id} value={u.email}>{u.name}</option>)}</datalist>
      <div style={{display:"flex",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <select value={plan} onChange={e=>setPlan(e.target.value)} style={{...C.input,flex:"1 1 160px"}}>
          <option value="premium">Премиум</option><option value="basic">Базалық</option>
        </select>
        <button disabled={busy||!em} onClick={()=>call("app_admin_issue_code",{p_email:em,p_plan:plan},d=>setRes(d))} style={{...C.btn,...C.pri,padding:"11px 20px",opacity:em?1:0.5}}>🔑 Код жасау</button>
        <button disabled={busy||!em} onClick={()=>call("app_admin_set_plan",{p_email:em,p_plan:plan},()=>showToast("Тариф берілді ✅"))} style={{...C.btn,...C.sec,padding:"11px 16px",opacity:em?1:0.5}}>Кодсыз тікелей беру</button>
      </div>
      {res&&(
        <div style={{background:"#F0FFF4",border:"1px solid #86EFAC",borderRadius:12,padding:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontFamily:"monospace",fontWeight:900,fontSize:28,letterSpacing:6,color:"#166534"}}>{res.code}</div>
          <a href={"https://wa.me/"+String(res.phone||"").replace(/[^0-9]/g,"")+"?text="+encodeURIComponent("Сәлем, "+(res.name||"")+"! Smart UBT активация кодыңыз: "+res.code)} target="_blank" rel="noopener"
            style={{background:"#25D366",color:"#fff",borderRadius:10,padding:"9px 16px",fontWeight:800,fontSize:13,textDecoration:"none"}}>💬 WhatsApp-қа жіберу</a>
        </div>
      )}
    </div>
  );
}

// Ішкі (ата-анаға тәуелді) компонентті тұрақты етіп көрсету: әйтпесе әр жаңартуда оның ішкі күйі (қадам, енгізілген код) жоғалады
function StableRender({fn}){return fn();}

// ── Формулалы мәтін: $...$ және $$...$$ — KaTeX, **...** — қалың, жаңа жол — <br> ──
const MATH_SPLIT=/(\$\$.+?\$\$|\$[^$\n]+?\$)/gs;
function texHtml(tex,display){
  try{return katex.renderToString(fixTex(tex),{throwOnError:false,displayMode:!!display,strict:"ignore"});}
  catch(e){return String(tex).replace(/[<>&]/g,"");}
}
function richParts(text){
  const out=[];let k=0;
  String(text??"").split(MATH_SPLIT).forEach(seg=>{
    if(!seg)return;
    if(seg.startsWith("$$")&&seg.endsWith("$$")&&seg.length>4){
      out.push(<span key={k++} className="ub-math" dangerouslySetInnerHTML={{__html:texHtml(seg.slice(2,-2),true)}}/>);
    }else if(seg.startsWith("$")&&seg.endsWith("$")&&seg.length>2){
      out.push(<span key={k++} className="ub-math" dangerouslySetInnerHTML={{__html:texHtml(seg.slice(1,-1),false)}}/>);
    }else{
      seg.split(/(\*\*.+?\*\*)/gs).forEach(piece=>{
        if(!piece)return;
        if(piece.startsWith("**")&&piece.endsWith("**")&&piece.length>4)out.push(<b key={k++}>{piece.slice(2,-2)}</b>);
        else piece.split("\n").forEach((line,i)=>{if(i>0)out.push(<br key={k++}/>);if(line)out.push(<React.Fragment key={k++}>{line}</React.Fragment>);});
      });
    }
  });
  return out;
}
function Rich({text}){
  const parts=React.useMemo(()=>richParts(text),[text]);
  return <>{parts}</>;
}

// ── Сабақ теориясы: сервер арқылы (құқығы бар оқушыға ғана) жүктеледі ──
function useTheory(lessonId){
  const [st,setSt]=React.useState(()=>THEORY_CACHE[lessonId]?{html:THEORY_CACHE[lessonId]}:{});
  React.useEffect(()=>{
    if(THEORY_CACHE[lessonId]){setSt({html:THEORY_CACHE[lessonId]});return;}
    let alive=true;setSt({});
    sbRpc("app_get_theory",{p_token:APP_TOKEN,p_lesson_id:lessonId}).then(r=>{
      if(!alive)return;
      if(r.ok&&r.data?.html){THEORY_CACHE[lessonId]=r.data.html;setSt({html:r.data.html});}
      else setSt({err:r.ok?(r.data?.error||"unknown"):r.error});
    });
    return()=>{alive=false;};
  },[lessonId]);
  return st;
}
function TheoryHtml({lessonId,onUpgrade}){
  const {html,err}=useTheory(lessonId);
  const ref=React.useRef(null);
  React.useEffect(()=>{
    if(!ref.current||!html)return;
    ref.current.querySelectorAll("span.math").forEach(el=>{
      const raw=el.textContent||"";
      const tex=raw.replace(/^\\[(\[]/,"").replace(/\\[)\]]$/,"");
      el.innerHTML=texHtml(tex,el.classList.contains("display"));
    });
  },[html]);
  if(err==="access")return <div style={{padding:"26px 16px",textAlign:"center"}}><div style={{fontSize:44}}>🔒</div><div style={{fontWeight:800,margin:"8px 0 14px"}}>Бұл сабақ жазылым ұсынады</div>{onUpgrade&&<button onClick={onUpgrade} style={{border:"none",borderRadius:12,padding:"12px 26px",fontWeight:800,fontSize:15,cursor:"pointer",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff"}}>Жазылу →</button>}</div>;
  if(err==="session")return <div style={{padding:20,textAlign:"center",color:"#B91C1C",fontWeight:700}}>⚠️ Сессия аяқталды. Шығып, қайта кіріңіз.</div>;
  if(err==="missing")return <div style={{padding:20,textAlign:"center",color:"#9CA3AF"}}>Бұл сабақтың теориясы әлі серверге жүктелмеген.</div>;
  if(err)return <div style={{padding:20,textAlign:"center",color:"#B91C1C",fontWeight:700}}>⚠️ Теорияны жүктеу мүмкін болмады. Интернетті тексеріп, бетті жаңартыңыз.</div>;
  if(!html)return <div style={{padding:30,textAlign:"center",color:"#9CA3AF",fontWeight:600}}>⏳ Теория жүктелуде...</div>;
  return <div ref={ref} className="ub-rich" dangerouslySetInnerHTML={{__html:html}}/>;
}

function LessonRichText({text}){
  if(!text)return null;
  const blocks=text.split(/\n\n+/);
  const renderInline=(s,ki)=>{
    const parts=s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p,i)=>p.startsWith("**")&&p.endsWith("**")
      ?<b key={ki+"-"+i} style={{color:"#1E1B4B"}}>{p.slice(2,-2)}</b>
      :<React.Fragment key={ki+"-"+i}>{p}</React.Fragment>);
  };
  return(
    <div style={{color:"#374151",fontSize:14,lineHeight:1.75}}>
      {blocks.map((block,bi)=>{
        const lines=block.split("\n").filter(l=>l.trim());
        if(!lines.length)return null;
        const isTableBlock=lines.length>=2&&lines[0].trim().startsWith("|")&&/^\|[\s:|-]+\|$/.test(lines[1]?.trim()||"");
        if(isTableBlock){
          const rows=[lines[0],...lines.slice(2)].map(l=>l.trim().replace(/^\||\|$/g,"").split("|").map(c=>c.trim()));
          return(
            <div key={bi} style={{overflowX:"auto",margin:"10px 0"}}>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:13}}>
                <thead><tr>{rows[0].map((c,ci)=><th key={ci} style={{textAlign:"left",padding:"6px 10px",background:"#EEF0FF",color:"#1E1B4B",fontWeight:800,border:"1px solid #E5E7EB"}}>{renderInline(c,bi+"h"+ci)}</th>)}</tr></thead>
                <tbody>{rows.slice(1).map((r,ri)=><tr key={ri}>{r.map((c,ci)=><td key={ci} style={{padding:"6px 10px",border:"1px solid #E5E7EB"}}>{renderInline(c,bi+"r"+ri+"c"+ci)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        if(/^####\s/.test(lines[0])){
          return <div key={bi} style={{fontWeight:800,fontSize:14,color:"#4F46E5",marginTop:16,marginBottom:6}}>{renderInline(lines[0].replace(/^####\s/,""),bi)}</div>;
        }
        if(/^###\s/.test(lines[0])){
          return <div key={bi} style={{fontWeight:900,fontSize:16,color:"#1E1B4B",marginTop:20,marginBottom:8,paddingTop:12,borderTop:"1px solid #EEF0FF"}}>{renderInline(lines[0].replace(/^###\s/,""),bi)}</div>;
        }
        const isBulletBlock=lines.every(l=>/^-\s/.test(l.trim()));
        const isNumBlock=lines.every(l=>/^\d+\.\s/.test(l.trim()));
        if(isBulletBlock){
          return <ul key={bi} style={{margin:"6px 0",paddingLeft:20}}>{lines.map((l,li)=><li key={li} style={{marginBottom:4}}>{renderInline(l.replace(/^-\s/,""),bi+"-"+li)}</li>)}</ul>;
        }
        if(isNumBlock){
          return <ol key={bi} style={{margin:"6px 0",paddingLeft:20}}>{lines.map((l,li)=><li key={li} style={{marginBottom:4}}>{renderInline(l.replace(/^\d+\.\s/,""),bi+"-"+li)}</li>)}</ol>;
        }
        return <p key={bi} style={{margin:"0 0 10px"}}>{renderInline(block,bi)}</p>;
      })}
    </div>
  );
}

// ── ҰБТ балл жүйесі: 1 балдық (бір жауап/мәнмәтін) және 2 балдық (сәйкестендіру/көп жауап) ──
const isMultiQ=q=>!!(q.multi||q.type==="multi");
const qWeight=q=>(q.type==="match"||isMultiQ(q))?2:1;
// Қате санын есептеу (нәтиже беті мен қателер банкі үшін; баллға әсер етпейді)
const countMistakes=(q,a)=>{
  if(q.type==="match"){
    const pairs=q.pairs||[];
    if(!a||typeof a!=="object")return pairs.length;
    return pairs.filter((pr,pi)=>{const ci=a[pi];return ci===undefined||ci===null||pairs[ci]?.right!==pr.right;}).length;
  }
  if(isMultiQ(q)){
    const correct=new Set(q.ans_all||[q.ans]);
    const given=new Set(Array.isArray(a)?a:(a===undefined||a===null?[]:[a]));
    let m=0;correct.forEach(x=>{if(!given.has(x))m++;});given.forEach(x=>{if(!correct.has(x))m++;});
    return m;
  }
  return a===q.ans?0:1;
};
// ── Ресми бағалау кестесі (ЕНТ Ережелері, 18-тармақ, 26.02.2026 редакциясы) ──
// Сәйкестендіру және бір/бірнеше дұрыс жауабы бар тапсырмалар (ең көбі 3 дұрыс жауап).
// Кесте: [дұрыс жауап саны][таңдалған дұрыс, таңдалған артық] → балл. Көрсетілмеген жағдай = 0 балл.
const MULTI_SCORE_TABLE={
  1:{"1,0":2,"1,1":1},                               // 1 дұрыс: дұрысы=2; дұрысы+1 қате=1; 2+ қате=0
  2:{"2,0":2,"1,0":1,"1,1":1,"2,1":1},               // 2 дұрыс: екеуі=2; біреуі=1; 1+1 қате=1; екеуі+1 қате=1
  3:{"3,0":2,"2,0":1,"2,1":1,"3,1":1},               // 3 дұрыс: үшеуі=2; екеуі=1; екеуі+1 қате=1; үшеуі+1 қате=1; тек біреуі=0
};
// 4 және одан көп сәйкестік (ресми кестеде жоқ): 3 дұрыстың ережесін жалпылаймыз — барлығы=2, 1 қателіктен артық емес және кемінде (c-1) дұрыс=1.
const multiScore=(c,s,w)=>{
  if(w>=2||c<=0)return 0;
  if(c<=3)return (MULTI_SCORE_TABLE[c]||{})[s+","+w]||0;
  if(s===c&&w===0)return 2;
  return (s>=c-1&&s>=2)?1:0;
};
// Таңдалған жауаптардан c (дұрыс саны), s (таңдалған дұрыс), w (таңдалған артық) санын шығару
const answerCounts=(q,a)=>{
  if(q.type==="match"){
    const pairs=q.pairs||[];let s=0,w=0;
    if(a&&typeof a==="object")pairs.forEach((pr,pi)=>{const ci=a[pi];if(ci===undefined||ci===null)return;if(pairs[ci]?.right===pr.right)s++;else w++;});
    return {c:pairs.length,s,w};
  }
  const correct=new Set(q.ans_all||[q.ans]);
  const given=new Set(Array.isArray(a)?a:(a===undefined||a===null?[]:[a]));
  let s=0,w=0;given.forEach(x=>{if(correct.has(x))s++;else w++;});
  return {c:correct.size,s,w};
};
const scoreQ=(q,a)=>{
  if(qWeight(q)===1)return a===q.ans?1:0;   // бір жауап және мәнмәтін: 1 / 0
  const {c,s,w}=answerCounts(q,a);
  return multiScore(c,s,w);
};
// ── Тарау қорытынды тесті: 40 тапсырма / 50 балл ──
// 1–25 бір жауап (25) · 26–30 мәнмәтін (5) · 31–35 сәйкестендіру (10) · 36–40 бір/бірнеше жауап (10)
const kindOf=q=>q.type==="match"?"match":isMultiQ(q)?"multi":(q.type==="context"||q.ctx)?"context":"single";
const FINAL_PLAN=[
  {k:"single",n:25,label:"1–25 · Бір дұрыс жауап",color:"#4F46E5"},
  {k:"context",n:5,label:"26–30 · Мәнмәтін негізіндегі сұрақтар",color:"#0EA5E9"},
  {k:"match",n:5,label:"31–35 · Сәйкестендіру",color:"#F59E0B"},
  {k:"multi",n:5,label:"36–40 · Бір немесе бірнеше дұрыс жауап",color:"#22C55E"},
];
// Тараудың қосымша сұрақтары (мәнмәтін және көп жауапты) — src/finalExtra.js ішінен
const extraFor=lid=>{
  const x=FINAL_EXTRA[lid];if(!x)return [];const out=[];
  const nid=(q,pfx,i)=>lid+"_"+(q.n?"q"+q.n:pfx+(i+1));
  (x.single||[]).forEach((q,i)=>out.push({...q,id:nid(q,"s",i)}));
  if(x.context)(x.context.qs||[]).forEach((q,i)=>out.push({...q,id:nid(q,"c",i),type:"context",ctx:x.context.text}));
  (x.match||[]).forEach((q,i)=>out.push({...q,id:nid(q,"x",i),type:"match"}));
  (x.multi||[]).forEach((q,i)=>out.push({...q,id:nid(q,"m",i),type:"multi",multi:true}));
  return out;
};
const buildFinal=pool=>{
  const num=q=>{const m=String(q.id).match(/_q(\d+)$/);return m?+m[1]:1e6;};
  const by={single:[],context:[],match:[],multi:[]};
  [...pool].sort((a,b)=>num(a)-num(b)).forEach(q=>by[kindOf(q)].push(q));
  const groups=FINAL_PLAN.map(p=>{const items=by[p.k].splice(0,p.n);return {...p,items,real:items.length};});
  // Мәнмәтін/көп жауапты сұрақтар жетпесе, орнына артық бір жауапты сұрақтар қойылады (50 балл толық болмайды)
  groups.forEach(g=>{if(g.k!=="single")while(g.items.length<g.n&&by.single.length)g.items.push(by.single.shift());});
  const qs=[],sections=[];
  groups.forEach(g=>{
    const pending=g.n-g.real;
    sections.push({label:g.label+(pending>0&&g.k!=="single"?" (жаңа формат дайындалуда)":""),color:g.color,start:qs.length,count:g.items.length,pending});
    qs.push(...g.items);
  });
  return {qs,sections};
};

// Тест таймері — өз алдына бөлек, тиек компонент. Секунд сайын тек ӨЗІ ғана
// қайта салынады, тест сұрақтары/жауап батырмалары тимейді (жыпылдауды болдырмайды).
function TestTimer({initialSeconds,onExpire}){
  const [time,setTime]=useState(initialSeconds);
  const expiredRef=useRef(false);
  const onExpireRef=useRef(onExpire);
  onExpireRef.current=onExpire;
  useEffect(()=>{
    setTime(initialSeconds);
    expiredRef.current=false;
    if(!(initialSeconds>0))return;
    const t=setInterval(()=>{
      setTime(p=>{
        if(p<=1){
          clearInterval(t);
          if(!expiredRef.current){expiredRef.current=true;onExpireRef.current?.();}
          return 0;
        }
        return p-1;
      });
    },1000);
    return()=>clearInterval(t);
  },[initialSeconds]);
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  return(
    <div style={{background:time<180?"#FEF2F2":"#EEF2FF",color:time<180?"#EF4444":"#4F46E5",padding:"8px 18px",borderRadius:20,fontWeight:900,fontSize:20,fontFamily:"monospace"}}>⏱ {fmt(time)}</div>
  );
}

class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error("SmartUBT crash:",error,info);}
  render(){
    if(this.state.error){
      return(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,background:"#0F0B2E",color:"#fff",textAlign:"center",fontFamily:"sans-serif"}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <div style={{fontWeight:900,fontSize:20,marginBottom:10}}>Бір қате орын алды</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:20,maxWidth:500}}>Кешіріңіз, беттің бір жерінде техникалық ақау шықты. Төмендегі мәтінді Ерназарға көрсетіңіз.</div>
          <pre style={{fontSize:11,color:"#FCA5A5",background:"rgba(0,0,0,0.3)",padding:12,borderRadius:8,maxWidth:600,overflow:"auto",textAlign:"left",marginBottom:20,whiteSpace:"pre-wrap"}}>{String(this.state.error?.stack||this.state.error?.message||this.state.error)}</pre>
          <button onClick={()=>{try{localStorage.removeItem("ubt3_page");}catch(e){}window.location.href="/";}} style={{padding:"12px 24px",borderRadius:12,background:"#4F46E5",color:"#fff",border:"none",fontWeight:800,cursor:"pointer",fontSize:14}}>🔄 Басты бетке қайту</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SmartUBTInner(){
  const _rawSaved=gS("ubt3_user",null);
  // Always correct role for known admin/superadmin accounts in saved session
  const _savedUser=_rawSaved
    ?_rawSaved.email==="ernazarnurtay@gmail.com"?{..._rawSaved,role:"superadmin",plan:"premium"}
    :_rawSaved.email==="nur.abuuadi@gmail.com"?{..._rawSaved,role:"admin",plan:"premium"}
    :_rawSaved
    :null;
  const _initPage=_savedUser?((_savedUser.role==="superadmin"||_savedUser.role==="admin"||_savedUser.role==="curator")?"admin":"home"):"welcome";
  const [page,setPage]=useState(_initPage);
  const [user,setUser]=useState(_savedUser);
  const [users,setUsers]=useState(()=>{
    const saved=gS("ubt3_users",INIT_USERS);
    // Always force-update admin and superadmin with correct roles
    const ADMIN_EMAIL="nur.abuuadi@gmail.com";
    const SUPER_EMAIL="ernazarnurtay@gmail.com";
    let base=saved;
    // Force-update admin (preserve existing data but always set correct role/password)
    const existingAdmin=base.find(u=>u.email===ADMIN_EMAIL);
    base=base.filter(u=>u.email!==ADMIN_EMAIL);
    base=[...base,{id:3,name:"Нұртай",avatar:"👑",createdAt:"2024-01-01",password:"admin",...(existingAdmin||{}),email:ADMIN_EMAIL,role:"admin",plan:"premium"}];
    // Force-update superadmin
    const existingSuper=base.find(u=>u.email===SUPER_EMAIL);
    base=base.filter(u=>u.email!==SUPER_EMAIL);
    base=[...base,{id:4,name:"Ернazar",avatar:"🚀",xp:9999,createdAt:"2024-01-01",password:"admin",...(existingSuper||{}),email:SUPER_EMAIL,role:"superadmin",plan:"premium",subjects:["chemistry"]}];
    return base;
  });
  const [content,setContent]=useState(()=>{
    const saved=gS("ubt3_content",INIT_CONTENT);
    // Always use INIT_VARIANTS as base, then add any admin-created variants on top
    // For each subject: if saved has MORE variants than INIT (admin added), keep them all
    // But always ensure INIT_VARIANTS questions are available
    // ALWAYS start fresh from INIT_VARIANTS, then add admin-created extras
    const baseVariants=INIT_VARIANTS;
    const savedVars=saved.variants||{};
    const mergedVariants={};
    Object.keys(baseVariants).forEach(sid=>{
      const initVs=baseVariants[sid]||[];
      const initIds=new Set(initVs.map(v=>v.id));
      const savedVs=savedVars[sid]||[];
      const adminAdded=savedVs.filter(v=>!initIds.has(v.id));
      mergedVariants[sid]=[...initVs,...adminAdded];
    });
    // Same fix for topics/lessons (Сабақтар): freshly-deployed curriculum (TOPICS) always
    // wins for chapters/lessons we authored, while any NEW chapter admin added by hand
    // (an id we don't recognize) is preserved on top. Prevents stale localStorage from
    // hiding curriculum updates after a redeploy.
    const savedTopics=saved.topics||{};
    const mergedTopics={};
    Object.keys(TOPICS).forEach(sid=>{
      const initTs=TOPICS[sid]||[];
      const initIds=new Set(initTs.map(t=>t.id));
      const savedTs=savedTopics[sid]||[];
      const adminAdded=savedTs.filter(t=>!initIds.has(t.id)&&!/^chemistry\d+$/.test(t.id));
      mergedTopics[sid]=[...initTs,...adminAdded];
    });
    Object.keys(savedTopics).forEach(sid=>{ if(!mergedTopics[sid])mergedTopics[sid]=savedTopics[sid]; });
    // lessonTests/hwTests/questions are flat {lessonId:[...]} maps — INIT_CONTENT's authored
    // entries win for matching lesson ids, admin-only extra entries are kept.
    const mergedLessonTests={...INIT_CONTENT.lessonTests};
    const mergedHwTests={...INIT_CONTENT.hwTests};
    const mergedQuestions={...(saved.questions||{}),...INIT_CONTENT.questions};
    return {...saved,variants:mergedVariants,topics:mergedTopics,lessonTests:mergedLessonTests,hwTests:mergedHwTests,questions:mergedQuestions};
  });
  const [showRef,setShowRef]=useState(false);
  const [confirmFinish,setConfirmFinish]=useState(false);
  const [lessonMedia,setLessonMedia]=useState(()=>gS("ubt3_media",{}));
  useEffect(()=>{
    let alive=true;
    (async()=>{const m=await sbFetchLessonMedia();if(alive&&m){setLessonMedia(m);sS("ubt3_media",m);}})();
    return()=>{alive=false;};
  },[]);
  const videoUrlOf=(ls)=>(lessonMedia[ls.id]?.video_url)||ls.videoUrl||"";
  const [results,setResults]=useState(gS("ubt3_results",[]));
  const [onboard,setOnboard]=useState({step:0,name:"",email:"",password:"",phone:"",grade:"11",profile:"natural",subjects:[],plan:"free",promoInput:"",planTab:"plans"});
  const [subjectId,setSubjectId]=useState(null);
  const [topicId,setTopicId]=useState(null);
  const [lessonId,setLessonId]=useState(null);
  const [gameMode,setGameMode]=useState(null);
  const [lessonTab,setLessonTab]=useState("video");
  const [test,setTest]=useState(null);
  const [loginForm,setLoginForm]=useState({email:"",password:""});
  const [showPw,setShowPw]=useState(false);
  const [loginErr,setLoginErr]=useState("");
  const [regBusy,setRegBusy]=useState(false);
  const [loginBusy,setLoginBusy]=useState(false);
  const [adminTab,setAdminTab]=useState("dash");
  const [adminModal,setAdminModal]=useState(null);
  const [variantPicker,setVariantPicker]=useState(null); // {sid} when open
  const [addStudentModal,setAddStudentModal]=useState(false);
  const [darkMode,setDarkMode]=useState(()=>{
    try{return localStorage.getItem('ubt_dark')==='1'||(!localStorage.getItem('ubt_dark')&&window.matchMedia('(prefers-color-scheme:dark)').matches);}catch{return false;}
  });
  const [ubtDate,setUbtDate]=useState(()=>localStorage.getItem('ubt_exam_date')||'2026-06-15');
  const [reportModal,setReportModal]=useState(null);
  const [leaderboardPage,setLeaderboardPage]=useState(false);
  const [certModal,setCertModal]=useState(null);

  // Apply dark mode
  React.useEffect(()=>{
    try{
      localStorage.setItem('ubt_dark',darkMode?'1':'0');
      document.documentElement.style.setProperty('--bg-main',darkMode?'#0F0F1A':'#F0F2FF');
      document.documentElement.style.setProperty('--bg-card',darkMode?'#1A1A2E':'#ffffff');
      document.documentElement.style.setProperty('--text-main',darkMode?'#E2E8FF':'#1E1B4B');
      document.documentElement.style.setProperty('--text-sub',darkMode?'#9BA3BF':'#6B7280');
      document.documentElement.style.setProperty('--border-col',darkMode?'rgba(255,255,255,0.08)':'#EEF0FF');
      document.body.style.background=darkMode?'#0F0F1A':'#F0F2FF';
    }catch{}
  },[darkMode]);
  // Page-level states (lifted to avoid React #310 - hooks-in-functions rule)
  const [subjectFilter,setSubjectFilter]=useState("all");
  const [lessonNote,setLessonNote]=useState("");
  const [writingAnswers,setWritingAnswers]=useState({});// {idx: userAnswer}
  const [writingChecked,setWritingChecked]=useState(false);
  const [writingScore,setWritingScore]=useState(null);
  const [lessonHwText,setLessonHwText]=useState("");
  const [lessonHwSent,setLessonHwSent]=useState(false);
  const [profileForm,setProfileForm]=useState({name:"",phone:"",school:"",city:""});
  const [aiMsgs,setAiMsgs]=useState([]);
  const [aiInput,setAiInput]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [toast,setToast]=useState(null);
  const [notifOpen,setNotifOpen]=useState(false);
  const [searchQ,setSearchQ]=useState("");
  const aiRef=useRef(null);
  const fileRef=useRef(null);

  // Version bump - clear old incompatible localStorage data
  useEffect(()=>{
    const v=localStorage.getItem("ubt3_version");
    if(v!=="v4"){
      localStorage.removeItem("ubt3_content");
      localStorage.removeItem("ubt3_users");
      localStorage.removeItem("ubt3_results");
      localStorage.removeItem("ubt3_user");
      localStorage.setItem("ubt3_version","v4");
      window.location.reload();
    }
  },[]);
  useEffect(()=>{sS("ubt3_users",users)},[users]);
  useEffect(()=>{sS("ubt3_content",content)},[content]);
  useEffect(()=>{sS("ubt3_results",results)},[results]);

  // Pull users from Supabase on load for staff, so pending activation codes
  // registered from a *different* device/browser still show up here.
  const syncUsersFromSupabase=useCallback(async()=>{
    const r=await sbRpc("app_admin_list_users",{p_token:APP_TOKEN});
    const rows=r.ok&&r.data?.users?r.data.users:[];
    if(!rows.length)return;
    setUsers(prev=>{
      const byEmail=new Map(prev.map(u=>[u.email,u]));
      rows.forEach(row=>byEmail.set(row.email,fromServerUser(row,byEmail.get(row.email))));
      return Array.from(byEmail.values());
    });
  },[]);
  useEffect(()=>{
    if(user&&(user.role==="admin"||user.role==="superadmin"||user.role==="curator")){
      syncUsersFromSupabase();
    }
  },[user?.role]);
  useEffect(()=>{if(aiRef.current)aiRef.current.scrollTop=aiRef.current.scrollHeight},[aiMsgs]);
  useEffect(()=>{if(user&&page==="welcome")setPage("home")},[user]);
  // Сессияны серверде тексеру: тариф мен рөл тек серверден алынады
  useEffect(()=>{
    if(!user)return;
    if(!APP_TOKEN){setUser(null);sS("ubt3_user",null);setPage("welcome");return;}
    let alive=true;
    sbRpc("app_me",{p_token:APP_TOKEN}).then(r=>{
      if(!alive||!r.ok)return;
      if(r.data?.error==="session"){setAppToken("");setUser(null);sS("ubt3_user",null);setPage("welcome");showToast("Сессия аяқталды. Қайта кіріңіз","err");return;}
      if(r.data?.user)setUser(prev=>{if(!prev)return prev;const f=fromServerUser(r.data.user,prev);sS("ubt3_user",f);return f;});
    });
    return()=>{alive=false;};
  },[user?.id]);

  const toastTimer=useRef(null);
  const showToast=(msg,type="ok")=>{setToast({msg,type});clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),3500);};
  const genCode=()=>{
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
  };

  const upContent=useCallback((key,val)=>setContent(p=>({...p,[key]:val})),[]);

  /* ── AUTH ── */
  const generateStudyPlan=useCallback((subs,startDate)=>{
    // Build weekly plan across all selected subjects
    const weeks=[];
    const allLessons=[];
    subs.forEach(sid=>{
      const tops=(content.topics||{})[sid]||[];
      tops.forEach(t=>{
        t.lessons.forEach(l=>{
          allLessons.push({sid,subjectName:SUBJECTS.find(s=>s.id===sid)?.name,topicTitle:t.title,lessonId:l.id,lessonTitle:l.title,done:false});
        });
      });
    });
    // 5 lessons per week
    const LESSONS_PER_WEEK=5;
    const sd=startDate?new Date(startDate):new Date();
    for(let i=0;i<Math.ceil(allLessons.length/LESSONS_PER_WEEK);i++){
      const wStart=new Date(sd);wStart.setDate(sd.getDate()+i*7);
      const wEnd=new Date(wStart);wEnd.setDate(wStart.getDate()+6);
      weeks.push({
        week:i+1,
        dateStart:wStart.toLocaleDateString("kk-KZ"),
        dateEnd:wEnd.toLocaleDateString("kk-KZ"),
        lessons:allLessons.slice(i*LESSONS_PER_WEEK,(i+1)*LESSONS_PER_WEEK),
        completed:false,
        testScore:null,
      });
    }
    return{weeks,totalLessons:allLessons.length,totalWeeks:weeks.length,createdAt:new Date().toLocaleDateString("kk-KZ"),currentWeek:1};
  },[content.topics]);

  const checkWeeklyProgress=useCallback((plan)=>{
    if(!plan||!plan.weeks)return null;
    const cw=plan.currentWeek||1;
    const week=plan.weeks[cw-1];
    if(!week)return null;
    const doneLessons=week.lessons.filter(l=>user?.progress?.[l.lessonId]).length;
    const total=week.lessons.length;
    return{cw,doneLessons,total,pct:Math.round(doneLessons/total*100),week};
  },[user?.progress]);

  const doRegister=()=>{
    if(!onboard.name||!onboard.email||!onboard.password)return showToast("Барлық міндетті өрістерді толтырыңыз","err");
    if(users.find(u=>u.email===onboard.email))return showToast("Бұл email тіркелген","err");
    if(!onboard.subjects.length)return showToast("Кем дегенде 1 пән таңдаңыз","err");
    const subs=onboard.subjects;
    // Generate study plan
    const plan=generateStudyPlan(subs,null);
    const nu={
      id:Date.now(),name:onboard.name,email:onboard.email,password:onboard.password,
      phone:onboard.phone,grade:onboard.grade,role:"student",plan:"free",
      profile:onboard.profile,subjects:subs,streak:0,xp:0,avatar:"🧑‍🎓",
      createdAt:new Date().toLocaleDateString("kk-KZ"),
      school:"",city:"",progress:{},scores:[],homework:{},notes:{},studyPlan:plan,
      notifications:[{id:Date.now(),text:"Smart UBT-ға қош келдіңіз! Апталық жоспар жасалды 📅",read:false,date:new Date().toLocaleDateString("kk-KZ")}]
    };
    setUsers(p=>[...p,nu]);setUser(nu);sS("ubt3_user",nu);
    showToast(`Қош келдіңіз, ${nu.name}! 🎉`);setPage("home");
  };
  // Контентті көшіруден қорғау: оқушыларға ғана (админ/куратор үшін өшірулі).
  // Бұл кездейсоқ көшіруді қиындатады; толық қорғау емес — watermark скриншотты қадағалауға көмектеседі.
  useEffect(()=>{
    const staff=!!user&&(user.role==="admin"||user.role==="superadmin"||user.role==="curator");
    if(staff)return;
    const isField=(el)=>!!el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA"||el.isContentEditable);
    const block=(e)=>{if(!isField(e.target))e.preventDefault();};
    const onKey=(e)=>{
      const k=(e.key||"").toLowerCase(),mod=e.ctrlKey||e.metaKey;
      if(e.key==="F12"||(mod&&e.shiftKey&&["i","j","c"].includes(k))||(mod&&["s","p","u"].includes(k))||(mod&&["c","x","a"].includes(k)&&!isField(e.target)))e.preventDefault();
    };
    ["contextmenu","copy","cut","dragstart"].forEach(n=>document.addEventListener(n,block));
    document.addEventListener("keydown",onKey);
    const st=document.createElement("style");
    st.id="ubt-protect";
    st.textContent="body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}input,textarea{-webkit-user-select:text;user-select:text}@media print{body{display:none!important}}";
    document.head.appendChild(st);
    return()=>{
      ["contextmenu","copy","cut","dragstart"].forEach(n=>document.removeEventListener(n,block));
      document.removeEventListener("keydown",onKey);
      st.remove();
    };
  },[user?.id,user?.role]);

  const doLogin=async()=>{
    const fail=(m)=>{setLoginErr(m);showToast(m,"err");};
    setLoginErr("");
    const email=(loginForm.email||"").trim();
    if(!email)return fail("Email енгізіңіз");
    if(!loginForm.password)return fail("Құпия сөзді енгізіңіз");
    if(loginBusy)return;
    setLoginBusy(true);
    try{
      const res=await sbRpc("app_login",{p_email:email,p_password:loginForm.password});
      if(!res.ok){
        if(res.error==="network")return fail("Серверге қосыла алмадық. Интернетті тексеріп, қайта көріңіз.");
        if(res.error==="http_404")return fail("Серверде кіру функциясы (app_login) табылмады. Supabase-те migration-phase-d-server.sql іске қосылмаған.");
        if(res.error==="http_401"||res.error==="http_403")return fail("Сервер кіруге рұқсат бермеді ("+res.error.slice(5)+"). Vercel-дегі VITE_SUPABASE_ANON_KEY кілтін тексеріңіз.");
        return fail("Сервер қатесі ("+res.error.slice(5)+"). Кейінірек қайталаңыз.");
      }
      const d=res.data;
      if(d?.error==="locked")return fail("Тым көп қате әрекет. 10 минуттан кейін қайталаңыз.");
      if(!d?.user||!d?.token)return fail("Email немесе құпия сөз қате.");
      setAppToken(d.token);
      const f=fromServerUser(d.user,users.find(u=>u.email===d.user.email));
      setUsers(p=>p.some(u=>u.email===f.email)?p.map(u=>u.email===f.email?f:u):[...p,f]);
      setUser(f);sS("ubt3_user",f);showToast(`Қош келдіңіз, ${f.name}!`);
      setPage(f.role==="superadmin"||f.role==="admin"||f.role==="curator"?"admin":"home");
    }finally{setLoginBusy(false);}
  };

  const doForgotPassword=async()=>{
    if(!loginForm.email)return showToast("Алдымен email енгізіңіз","err");
    const res=await sbAuthRecover(loginForm.email);
    if(res.ok)showToast("Сілтеме "+loginForm.email+" мекенжайына жіберілді 📩");
    else showToast("Бұл email жаңа тіркелгі емес — админге хабарласыңыз","err");
  };
  const doLogout=()=>{if(APP_TOKEN)sbRpc("app_logout",{p_token:APP_TOKEN});setAppToken("");setUser(null);sS("ubt3_user",null);setPage("welcome")};
  const updateUser=useCallback((upd)=>{
    setUser(prev=>{
      const nu={...prev,...(typeof upd==="function"?upd(prev):upd)};
      sS("ubt3_user",nu);
      setUsers(p=>p.map(u=>u.id===nu.id?nu:u));
      return nu;
    });
  },[]);

  /* ── STUDY PLAN ── */


  /* ── TEST ── */
  const startTest=(sid,retryIds=null)=>{
    // If retry mode - use questions from wrong answers pool
    if(retryIds){
      const allQs=Object.values(content.variants?.[sid]||{}).flatMap(v=>[]).concat(
        (content.variants?.[sid]||[]).flatMap(v=>v.questions)
      );
      const pool=[...allQs,...(content.questions?.[sid]||[])];
      const qs=pool.filter(q=>retryIds.includes(q.id));
      if(!qs.length)return showToast("Қате сұрақтар табылмады","err");
      setTest({sid,qs,curr:0,ans:{},time:20*60,done:false,retry:true,mode:"main"});
      setPage("test");
      return;
    }
    // Normal test: show variant picker
    const variants=content.variants?.[sid]||[];
    if(!variants.length)return showToast("Тест нұсқалары жоқ. Admin нұсқа қосу керек.","err");
    setVariantPicker({sid});
  };
  const startVariantTest=(sid,variantId)=>{
    const variant=(content.variants?.[sid]||[]).find(v=>v.id===variantId);
    if(!variant)return showToast("Нұсқа табылмады","err");
    const qs=variant.questions||[];
    if(!qs.length)return showToast("Бұл нұсқада сұрақтар жоқ","err");
    setVariantPicker(null);
    setTest({sid,qs,curr:0,ans:{},time:(variant.timeMin||80)*60,done:false,mode:"main",variantTitle:variant.title});
    setPage("test");
  };
  const [startingTest,setStartingTest]=useState(false);
  const startServerTest=async(sid,lid)=>{
    if(startingTest)return;
    setStartingTest(true);
    const res=await sbRpc("app_get_test",{p_token:APP_TOKEN,p_test_id:lid});
    setStartingTest(false);
    const d=res.data;
    if(!res.ok)return showToast(res.error==="network"?"Серверге қосыла алмадық. Интернетті тексеріңіз":res.error==="http_404"?"Серверде app_get_test табылмады (SQL іске қосылмаған)":"Сервер қатесі ("+res.error.slice(5)+")","err");
    if(d?.error==="access"){setAdminModal({type:"payment"});return;}
    if(d?.error==="session")return showToast("Сессия аяқталды. Шығып, қайта кіріңіз","err");
    if(d?.error==="missing")return showToast("Бұл тест әлі серверге жүктелмеген","err");
    if(!d?.questions)return showToast("Тестті жүктеу мүмкін болмады","err");
    const qs=d.questions.map(pq=>({id:pq.id,srv:true,n:pq.n,q:pq.q,
      type:pq.kind==="context"?"context":pq.kind==="match"?"match":pq.kind==="multi"?"multi":undefined,
      multi:pq.kind==="multi",opts:pq.opts,ctx:pq.ctx,
      pairs:pq.lefts?pq.lefts.map(left=>({left})):undefined,rights:pq.rights,labels:pq.labels}));
    const plan=[["single","1–25 · Бір дұрыс жауап","#4F46E5"],["context","26–30 · Мәнмәтін негізіндегі сұрақтар","#0EA5E9"],["match","31–35 · Сәйкестендіру","#F59E0B"],["multi","36–40 · Бір немесе бірнеше дұрыс жауап","#22C55E"]];
    const sections=[];let pos=0;
    plan.forEach(([k,label,color])=>{const cnt=d.questions.filter(pq=>pq.kind===k).length;if(cnt){sections.push({label,color,start:pos,count:cnt,pending:0});pos+=cnt;}});
    setTest({sid,qs,curr:0,ans:{},time:(d.minutes||60)*60,done:false,mode:"fix",lessonId:lid,sections,review:true,server:true,attemptId:d.attempt_id});
    setPage("test");
  };
  const startLessonTest=(sid,lid,mode)=>{
    if(isReviewId(lid)&&mode!=="hw"){startServerTest(sid,lid);return;}
    const countKey=mode==="hw"?"hwTestCount":"fixTestCount";
    const configCount=(content[countKey]||{})[lid]||(mode==="hw"?20:10);
    const isRev=String(lid).endsWith("_review");
    const useExtraOnly=isRev&&mode!=="hw"&&FINAL_EXTRA[lid]?.replace;
    const pool=useExtraOnly?extraFor(lid):[...((mode==="hw"?content.hwTests?.[lid]:content.lessonTests?.[lid])||[]),...(isRev&&mode!=="hw"?extraFor(lid):[])];
    if(!pool.length)return showToast(mode==="hw"?"Үй жұмысы сұрақтары жоқ":"Бекіту сұрақтары жоқ","err");
    const fin=isRev&&mode!=="hw"?buildFinal(pool):null;
    const qs=fin?fin.qs:[...pool].sort(()=>Math.random()-0.5);
    const mins=mode==="hw"?30:(FINAL_EXTRA[lid]?.minutes||(pool.length>=40?60:20));
    setTest({sid,qs,curr:0,ans:{},time:mins*60,done:false,mode,lessonId:lid,sections:fin?fin.sections:undefined,review:!!fin});
    setPage("test");
  };
  // Ескерту: секундтық санауыш енді бөлек TestTimer компонентінде — жалпы тест УИ-ін
  // әр секунд сайын толық қайта салудың алдын алу үшін (жыпылдау мәселесін болдырмау).

  const buildQIndex=()=>{
    const idx={},lessonInfo={},topicById={};
    Object.values(content.topics||{}).forEach(arr=>(arr||[]).forEach(t=>{topicById[t.id]=t.title;(t.lessons||[]).forEach(l=>{lessonInfo[l.id]={topic:t.title,lesson:l.title};});}));
    const add=(q,topic)=>{if(q&&q.id!==undefined&&!idx[q.id])idx[q.id]={q,topic};};
    [content.lessonTests,content.hwTests].forEach(bank=>Object.entries(bank||{}).forEach(([lid,qs])=>(qs||[]).forEach(q=>{
      const m=String(q.id).match(/^chem_t(\d+)_q/);
      add(q,m?(topicById["chem_t"+m[1]]||lid):(lessonInfo[lid]?.lesson||lessonInfo[lid]?.topic||lid));
    })));
    Object.keys(FINAL_EXTRA).forEach(lid=>extraFor(lid).forEach(q=>add(q,lessonInfo[lid]?.lesson||lid)));
    return idx;
  };
  const startQuestionsTest=(qs,sid,mode,mins)=>{
    if(!qs||!qs.length)return showToast("Сұрақтар табылмады","err");
    setTest({sid:sid||"chemistry",qs,curr:0,ans:{},time:(mins||Math.max(5,qs.length*2))*60,done:false,mode});
    setPage("test");
  };
  const startMistakeTest=(dueOnly)=>{
    const idx=buildQIndex();const today=new Date().toISOString().slice(0,10);
    const ids=Object.entries(user?.mistakes||{}).filter(([id,m])=>!dueOnly||(m.next||"")<=today).map(([id])=>id);
    const qs=ids.map(id=>idx[id]?.q||(user?.mistakes?.[id]?.snap)).filter(Boolean).slice(0,20);
    if(!qs.length)return showToast(dueOnly?"Бүгін қайталайтын сұрақ жоқ 🎉":"Қателер банкі бос","err");
    startQuestionsTest(qs.map(q=>({...q})),"chemistry","errors");
  };
  const setErrType=(qid,type)=>updateUser(prev=>({mistakes:{...(prev.mistakes||{}),[qid]:{...((prev.mistakes||{})[qid]||{}),type}}}));

  const snapOf=(q)=>({id:q.id,q:q.q,opts:q.opts,ans:q.ans,ans_all:q.ans_all,pairs:q.pairs,rights:q.rights,labels:q.labels,type:q.type,multi:q.multi,ctx:q.ctx,exp:q.exp});
  const completeTest=(ts,detailed,pts,maxPts,ok,wrong)=>{
    const score=maxPts?Math.round(pts/maxPts*100):0;
    const secStats=ts.sections?ts.sections.map(sc=>{let pp=0,mm=0,full=0;for(let i=sc.start;i<sc.start+sc.count;i++){const d=detailed[i];if(!d)continue;pp+=d.pts;mm+=d.w;if(d.pts===d.w)full++;}return {label:sc.label,color:sc.color,pts:pp,max:mm,count:sc.count,full};}):null;
    const r={sections:secStats,id:Date.now(),sid:ts.sid,subjectName:SUBJECTS.find(s=>s.id===ts.sid)?.name,score,points:pts,maxPoints:maxPts,correct:ok,total:ts.qs.length,wrong,date:new Date().toLocaleDateString("kk-KZ"),userId:user?.id,userName:user?.name,mode:ts.mode,lessonId:ts.lessonId,detailedQs:detailed};
    if(user){
      const idx=buildQIndex();
      const addDays=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10);};
      const todayStr=addDays(0);
      updateUser(prev=>{
        const patch={};
        if(ts.lessonId){
          const curLp=(prev.lessonProgress?.[ts.lessonId])||{};
          let lpPatch=null;
          if(ts.mode==="fix"){const best=Math.max(score,curLp.bekituScore||0);lpPatch={bekituScore:best};if(isReviewId(ts.lessonId)&&best>=REVIEW_PASS)patch.progress={...(prev.progress||{}),[ts.lessonId]:true};}
          else if(ts.mode==="hw")lpPatch={hwScore:score,hwResult:{score,points:pts,maxPoints:maxPts,correct:ok,total:ts.qs.length,detailedQs:detailed,wrong}};
          if(lpPatch)patch.lessonProgress={...(prev.lessonProgress||{}),[ts.lessonId]:{...curLp,...lpPatch}};
        }
        const mb={...(prev.mistakes||{})};
        detailed.forEach(q=>{
          const rec=mb[q.id];
          if(q.pts<q.w){mb[q.id]={...(rec||{}),...(ts.server?{snap:snapOf(q)}:{}),n:((rec&&rec.n)||0)+1,topic:idx[q.id]?.topic||rec?.topic||"",last:todayStr,next:addDays(2),stage:0};}
          else if(rec&&ts.mode==="errors"){
            if((rec.stage||0)>=1)delete mb[q.id];else mb[q.id]={...rec,stage:1,next:addDays(7),last:todayStr};
          }
        });
        patch.mistakes=mb;
        const hwUpd=ts.mode==="hw"&&ts.lessonId?{[ts.lessonId+"_result"]:{score,correct:ok,total:ts.qs.length,detailedQs:detailed,date:r.date}}:{};
        patch.homework={...(prev.homework||{}),...hwUpd};
        patch.xp=(prev.xp||0)+Math.round(score/10)*5;
        patch.scores=[...(prev.scores||[]),r];
        return patch;
      });
    }
    setResults(p=>[r,...p]);
    setTest(p=>({...p,done:true,result:r}));
    setPage("result");
  };
  const submitServerTest=async(ts)=>{
    if(ts.submitting)return;
    setTest(p=>p?{...p,submitting:true}:p);
    const answers=ts.qs.map((q,i)=>{const a=ts.ans[i];return a===undefined?null:a;});
    const res=await sbRpc("app_submit_test",{p_token:APP_TOKEN,p_attempt_id:ts.attemptId,p_answers:answers});
    const d=res.data;
    if(!res.ok||!d||d.error){
      setTest(p=>p?{...p,submitting:false}:p);
      return showToast(d?.error==="session"?"Сессия аяқталды. Шығып, қайта кіріңіз":d?.error==="done"?"Бұл тест бұрын тапсырылған":"Нәтижені жіберу мүмкін болмады. Интернетті тексеріп, қайта аяқтаңыз","err");
    }
    let ok=0;const wrong=[];
    const detailed=ts.qs.map((q,i)=>{
      const dt=d.details[i]||{};
      const base={...q,userAns:ts.ans[i],pts:dt.pts||0,w:dt.w||qWeight(q),exp:dt.exp||undefined};
      if(dt.kind==="multi")base.ans_all=dt.correct;
      else if(dt.kind==="match"){
        base.pairs=(q.pairs||[]).map((pr,pi)=>({left:pr.left,right:q.rights[dt.correct[pi]]}));
        const ua=ts.ans[i]||{};const conv={};
        Object.keys(ua).forEach(pi=>{const ci=base.pairs.findIndex(pr=>pr.right===q.rights[ua[pi]]);if(ci>=0)conv[pi]=ci;});
        base.userAns=conv;
      }else base.ans=dt.correct;
      if(base.pts===base.w)ok++;else wrong.push(q.id);
      return base;
    });
    completeTest(ts,detailed,d.points,d.max,ok,wrong);
  };
  const finishTest=(ts=test)=>{
    if(!ts||ts.done)return;
    if(ts.server){submitServerTest(ts);return;}
    let pts=0,maxPts=0,ok=0;const wrong=[];
    const detailed=ts.qs.map((q,i)=>{
      const w=qWeight(q),pp=scoreQ(q,ts.ans[i]);
      pts+=pp;maxPts+=w;if(pp===w)ok++;else wrong.push(q.id);
      return {...q,userAns:ts.ans[i],pts:pp,w};
    });
    completeTest(ts,detailed,pts,maxPts,ok,wrong);
  };

  /* ── AI ── */
  const askAI=async()=>{
    if(!aiInput.trim())return;
    const msg=aiInput;setAiInput("");
    setAiMsgs(p=>[...p,{role:"user",text:msg}]);setAiLoad(true);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          system:"Сен Smart UBT қосымшасының AI мұғалімісің. Қазақстандық ҰБТ-ға дайындалатын оқушыларға жәрдем бересің. БАРЛЫҚ жауапты қазақ тілінде жаз. Мектеп пәндерін түсіндір, формулалар мен мысалдар келтір. Жауабыңды нақты, оқушыға түсінікті жаз.",
          messages:[...aiMsgs.map(m=>({role:m.role,content:m.text})),{role:"user",content:msg}]})});
      const d=await res.json();
      setAiMsgs(p=>[...p,{role:"assistant",text:d.content?.[0]?.text||"Қате орын алды"}]);
    }catch{setAiMsgs(p=>[...p,{role:"assistant",text:"API қатесі. Желі байланысын тексеріңіз."}]);}
    setAiLoad(false);
  };

  const myResults=results.filter(r=>r.userId===user?.id);
  const avgScore=myResults.length?Math.round(myResults.reduce((a,b)=>a+b.score,0)/myResults.length):0;
  const unreadNotifs=(user?.notifications||[]).filter(n=>!n.read).length;

  /* ════════════════════════════════════════════════════════
     STYLES
  ════════════════════════════════════════════════════════ */
  const C={
    ...GC,
    card:{
      background:darkMode?'#1A1A2E':'#ffffff',
      borderRadius:20,
      boxShadow:darkMode?'0 2px 20px rgba(0,0,0,0.4)':'0 2px 20px rgba(79,70,229,0.08)',
      border:darkMode?'1px solid rgba(255,255,255,0.08)':'1px solid #EEF0FF',
    },
    input:{
      width:'100%',padding:'11px 14px',borderRadius:12,
      border:darkMode?'1.5px solid rgba(255,255,255,0.1)':'1.5px solid #E5E7EB',
      background:darkMode?'#0F0F1A':'#FAFAFA',
      color:darkMode?'#E2E8FF':'#1E1B4B',
      fontSize:15,fontFamily:'inherit',outline:'none',
      WebkitAppearance:'none',
    },
    btn:{padding:'10px 20px',borderRadius:12,border:'none',cursor:'pointer',fontWeight:700,fontSize:14,fontFamily:'inherit',transition:'all 0.18s'},
    pri:{background:'linear-gradient(135deg,#4F46E5,#7C3AED)',color:'#fff',boxShadow:'0 4px 14px rgba(79,70,229,0.3)'},
    sec:{background:darkMode?'rgba(255,255,255,0.08)':'#F3F4F6',color:darkMode?'#E2E8FF':'#374151'},
    warn:{background:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#fff'},
    danger:{background:'linear-gradient(135deg,#EF4444,#DC2626)',color:'#fff'},
    success:{background:'linear-gradient(135deg,#22C55E,#16A34A)',color:'#fff'},
    text:{color:darkMode?'#E2E8FF':'#1E1B4B'},
    subText:{color:darkMode?'#9BA3BF':'#6B7280'},
    bg:{background:darkMode?'#0F0F1A':'#F0F2FF'},
  };

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  /* ════════════════════════════════════════════════════════
     PAGE: WELCOME
  ════════════════════════════════════════════════════════ */
  const PageWelcome=()=>(
    <div style={{minHeight:"100dvh",background:"linear-gradient(135deg,#1E1B4B 0%,#312E81 40%,#4C1D95 70%,#BE185D 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"clamp(16px,5vw,32px)",paddingBottom:"calc(clamp(16px,5vw,32px) + env(safe-area-inset-bottom,0px))",position:"relative",overflow:"hidden"}}>
      {/* BG orbs */}
      {[{w:400,h:400,top:-100,left:-100,op:0.12},{w:300,h:300,bottom:-80,right:-80,op:0.1},{w:200,h:200,top:"40%",left:"60%",op:0.08}].map((o,i)=>(
        <div key={i} style={{position:"absolute",width:o.w,height:o.h,top:o.top,bottom:o.bottom,left:o.left,right:o.right,background:"radial-gradient(circle,#fff,transparent)",opacity:o.op,borderRadius:"50%",pointerEvents:"none"}}/>
      ))}
      <div style={{position:"relative",textAlign:"center",maxWidth:560}}>
        <div style={{fontSize:72,marginBottom:16,filter:"drop-shadow(0 8px 24px rgba(0,0,0,0.3))"}}>⚡</div>
        <h1 style={{fontSize:42,fontWeight:900,color:"#fff",letterSpacing:-1.5,marginBottom:16,lineHeight:1.1}}>Smart UBT App</h1>
        <p style={{color:"rgba(255,255,255,0.75)",fontSize:18,marginBottom:12,lineHeight:1.6}}>Қазақстанның ең заманауи ҰБТ дайындық платформасы</p>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:36}}>
          {["🤖 AI Мұғалім","📹 Видео сабақтар","✏️ ҰБТ тесттер","📊 Прогресс бақылау"].map(f=>(
            <span key={f} style={{background:"rgba(255,255,255,0.15)",color:"#fff",borderRadius:99,padding:"6px 14px",fontSize:13,fontWeight:600,backdropFilter:"blur(8px)"}}>{f}</span>
          ))}
        </div>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button style={{...C.btn,background:"#fff",color:"#4F46E5",padding:"14px 32px",fontSize:16,borderRadius:14}} onClick={()=>setPage("register")}>
            Тегін бастау →
          </button>
          <button style={{...C.btn,background:"rgba(255,255,255,0.15)",color:"#fff",padding:"14px 28px",fontSize:16,borderRadius:14,backdropFilter:"blur(8px)"}} onClick={()=>setPage("login")}>
            Кіру
          </button>
        </div>
        <div style={{marginTop:32,color:"rgba(255,255,255,0.5)",fontSize:13}}>
          Кіру үшін тіркелуіңіз немесе аккаунтыңыз болуы керек
        </div>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════
     PAGE: REGISTER (3-step onboarding)
  ════════════════════════════════════════════════════════ */
  const PageRegister=()=>{
    const s=onboard.step;
    const STEPS=["Профиль","Пәндер","Растау","Төлем & Код"];

    const calcPrice=(subs)=>{
      const n=subs.length;
      if(n===0)return 0;
      if(n===1)return 1990;
      if(n===2)return 3490;
      if(n===3)return 4990;
      if(n===4)return 6490;
      return 7990;
    };
    const price=calcPrice(onboard.subjects);
    const WA=content?.settings?.whatsappNum||"+7 777 190 27 96";

    const handleCode=async()=>{
      const code=(onboard.codeInput||"").trim().toUpperCase();
      if(code.length<6)return showToast("6 орынды кодты толық енгізіңіз","err");
      // Check: code matches either onboard.unlockCode (same browser) or any pending user's code (local)
      let pendingMatch=users.find(u=>u.status==="pending"&&u.email===onboard.email&&u.unlockCode===code);
      let matchedSubjects=pendingMatch?.subjects;
      // Fallback: verify against Supabase directly — covers page reload, closed tab, or a different device
      if(code!==onboard.unlockCode&&!pendingMatch){
        const dbUser=await sbFetchUserByEmail(onboard.email);
        if(dbUser&&String(dbUser.unlock_code||"").toUpperCase()===code){
          pendingMatch=dbUser;
          matchedSubjects=dbUser.subjects;
        }
      }
      if(code!==onboard.unlockCode&&!pendingMatch)return showToast("Код қате немесе белсенді емес","err");
      const allSubs=[...new Set([...(matchedSubjects||onboard.subjects)])];
      const plan=generateStudyPlan(allSubs,null);
      const unlockCode2=genCode();
      // New accounts: real password → Supabase Auth (hashed). Not stored in `users` table anymore.
      const authRes=await sbAuthSignUp(onboard.email,onboard.password);
      const nu={
        id:Date.now(),name:onboard.name,email:onboard.email,
        password:authRes.ok?"":onboard.password, // fallback: keep legacy plaintext only if Auth signup failed
        authId:authRes.ok?authRes.authId:null,
        phone:onboard.phone,grade:onboard.grade,role:"student",plan:"premium",
        profile:"custom",subjects:allSubs,streak:0,xp:0,avatar:"🧑‍🎓",
        activationCode:code,unlockCode:unlockCode2,
        createdAt:new Date().toLocaleDateString("kk-KZ"),
        school:"",city:"",progress:{},scores:[],homework:{},notes:{},studyPlan:plan,
        notifications:[
          {id:Date.now(),text:"Smart UBT-қа қош келдіңіз! Премиум белсендірілді 🎉",read:false,date:new Date().toLocaleDateString("kk-KZ")},
        ]
      };
      setUsers(p=>[...p.filter(x=>!(x.status==="pending"&&x.email===nu.email)),nu]);setUser(nu);sS("ubt3_user",nu);
      showToast("Премиум белсендірілді! Қош келдіңіз 🎉");
      setPage("home");
      sbUpsertUser(nu); // sync activated account to Supabase
    };

    const handleFreeReg=async()=>{
      const subs=["chemistry"];
      const email=(onboard.email||"").trim().toLowerCase();
      const plan=generateStudyPlan(subs,null);
      const res=await sbRpc("app_register",{p_email:email,p_password:onboard.password,p_name:onboard.name.trim(),p_phone:onboard.phone.trim(),p_grade:String(onboard.grade)});
      if(!res.ok)return showToast(res.error==="network"?"Серверге қосыла алмадық. Интернетті тексеріңіз":res.error==="http_404"?"Серверде тіркелу функциясы (app_register) табылмады. SQL іске қосылмаған":"Сервер қатесі ("+res.error.slice(5)+")","err");
      const d=res.data;
      if(d?.error==="exists")return showToast("Бұл email тіркелген. «Кіру» батырмасын басыңыз","err");
      if(d?.error==="email")return showToast("Email дұрыс емес","err");
      if(d?.error==="password")return showToast("Құпия сөз кем дегенде 6 таңба","err");
      if(!d?.user||!d?.token)return showToast("Тіркелу мүмкін болмады. Кейінірек қайталаңыз","err");
      setAppToken(d.token);
      const nu={...fromServerUser(d.user,null),studyPlan:plan,homework:{},notes:{},school:"",city:"",
        notifications:[{id:Date.now(),text:"Smart UBT-қа қош келдіңіз! Тегін сабақтардан бастаңыз.",read:false,date:new Date().toLocaleDateString("kk-KZ")}]};
      setUsers(p=>[...p,nu]);setUser(nu);sS("ubt3_user",nu);
      showToast("Тіркелдіңіз! Тегін режимде бастаңыз 🎓");
      setPage("home");
    };

    return(
      <div style={{minHeight:"100dvh",background:"linear-gradient(135deg,#F0F2FF 0%,#FAF5FF 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"clamp(16px,4vw,24px)",paddingTop:"max(20px,env(safe-area-inset-top,0px))"}}>
        <div style={{...C.card,width:"100%",maxWidth:"min(500px,100%)",padding:"clamp(18px,5vw,32px)"}}>

          {/* Step indicator */}
          <div style={{display:s===0?"none":"flex",alignItems:"center",marginBottom:24}}>
            {STEPS.map((st,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",flex:i<STEPS.length-1?1:"auto"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,
                    background:i<s?"#22C55E":i===s?"linear-gradient(135deg,#4F46E5,#7C3AED)":"#EEF0FF",
                    color:i<=s?"#fff":"#9CA3AF",transition:"all 0.3s",flexShrink:0}}>
                    {i<s?"✓":i+1}
                  </div>
                  <span style={{fontSize:8,fontWeight:i===s?700:400,color:i===s?"#4F46E5":"#C4C9D4",whiteSpace:"nowrap"}}>{st}</span>
                </div>
                {i<STEPS.length-1&&<div style={{flex:1,height:2,background:i<s?"#22C55E":"#EEF0FF",margin:"0 4px",borderRadius:99,marginBottom:14}}/>}
              </div>
            ))}
          </div>

          {/* ── STEP 0: Тегін тіркелу (бір экран) ── */}
          {s===0&&(
            <div>
              <h2 style={{fontWeight:900,fontSize:22,marginBottom:4,color:"#1E1B4B"}}>🎓 Тегін бастау</h2>
              <p style={{color:"#9CA3AF",fontSize:14,marginBottom:20}}>Бір минутта тіркеліп, тегін сабақпен танысыңыз</p>
              <input type="text" autoComplete="name" placeholder="Аты-жөніңіз *" value={onboard.name}
                onChange={e=>setOnboard(p=>({...p,name:e.target.value}))} style={{...C.input,marginBottom:12}}/>
              <input type="tel" autoComplete="tel" inputMode="tel" placeholder="Телефон номері * (+7 7xx xxx xx xx)" value={onboard.phone}
                onChange={e=>setOnboard(p=>({...p,phone:e.target.value}))} style={{...C.input,marginBottom:12}}/>
              <input type="email" autoComplete="email" placeholder="Email *" value={onboard.email}
                onChange={e=>setOnboard(p=>({...p,email:e.target.value}))} style={{...C.input,marginBottom:12}}/>
              <select value={onboard.grade} onChange={e=>setOnboard(p=>({...p,grade:e.target.value}))}
                style={{...C.input,marginBottom:12}}>
                {[9,10,11].map(g=><option key={g} value={g}>{g}-сынып</option>)}
              </select>
              <input type="password" autoComplete="new-password" placeholder="Кіру үшін құпия сөз ойлап табыңыз (мин. 6 таңба) *" value={onboard.password}
                onChange={e=>setOnboard(p=>({...p,password:e.target.value}))} style={{...C.input,marginBottom:20}}
                onKeyDown={e=>e.key==="Enter"&&document.getElementById("ubt-free-reg-btn")?.click()}/>
              <button id="ubt-free-reg-btn" disabled={regBusy} style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15,opacity:regBusy?0.7:1}} onClick={async()=>{
                if(regBusy)return;
                if(!onboard.name.trim())return showToast("Аты-жөніңізді жазыңыз","err");
                if((onboard.phone||"").replace(/\D/g,"").length<10)return showToast("Телефон нөмірін толық жазыңыз","err");
                if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((onboard.email||"").trim()))return showToast("Email дұрыс емес","err");
                if(!onboard.password||onboard.password.length<6)return showToast("Құпия сөз кем дегенде 6 таңба","err");
                setRegBusy(true);
                try{await handleFreeReg();}finally{setRegBusy(false);}
              }}>{regBusy?"Тіркелуде...":"Тегін бастау →"}</button>
              <p style={{textAlign:"center",fontSize:11,color:"#9CA3AF",marginTop:10,lineHeight:1.5}}>Тіркелу арқылы жаңалықтар мен ұсыныстар жіберуге келісесіз</p>
              <div style={{textAlign:"center",marginTop:12,fontSize:14,color:"#9CA3AF"}}>
                Аккаунтым бар? <span style={{color:"#4F46E5",cursor:"pointer",fontWeight:700}} onClick={()=>setPage("login")}>Кіру</span>
              </div>
            </div>
          )}

          {/* ── STEP 1: Subject picker ── */}
          {s===1&&(
            <div>
              <h2 style={{fontWeight:900,fontSize:20,marginBottom:4,color:"#1E1B4B"}}>📚 Пәндерді таңдаңыз</h2>
              <p style={{color:"#9CA3AF",fontSize:13,marginBottom:12}}>1 немесе одан да көп пән таңдаңыз</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:7,marginBottom:12}}>
                {SUBJECTS.map(sub=>{
                  const isMand=MANDATORY_SUBS.includes(sub.id);
                  const sel=onboard.subjects.includes(sub.id);
                  return(
                    <div key={sub.id} onClick={()=>{
                      const isIn=onboard.subjects.includes(sub.id);
                      setOnboard(p=>({...p,subjects:isIn?p.subjects.filter(x=>x!==sub.id):[...p.subjects,sub.id]}));
                    }} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:12,
                      cursor:"pointer",transition:"all 0.15s",
                      background:sel?sub.bg:"#F9FAFB",
                      border:`2px solid ${sel?sub.color:"#E5E7EB"}`}}>
                      <div style={{width:32,height:32,borderRadius:8,background:sel?sub.color:"#E5E7EB",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                        {sub.icon}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:11,color:sel?sub.color:"#9CA3AF",lineHeight:1.2}}>{sub.name}</div>
                        {isMand&&<div style={{fontSize:9,color:"#F59E0B",fontWeight:700}}>📌 Міндетті</div>}
                      </div>
                      <div style={{width:18,height:18,borderRadius:"50%",background:sel?sub.color:"#E5E7EB",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {sel&&<span style={{color:"#fff",fontSize:10,fontWeight:900}}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {onboard.subjects.length>0&&(
                <div style={{background:"linear-gradient(135deg,#EEF2FF,#F5F3FF)",borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #C7D2FE"}}>
                  <div style={{fontWeight:800,fontSize:13,color:"#4F46E5"}}>{onboard.subjects.length} пән таңдалды</div>
                  <div style={{fontWeight:900,fontSize:16,color:"#4F46E5"}}>{price.toLocaleString()} ₸</div>
                </div>
              )}
              <div style={{display:"flex",gap:8}}>
                <button style={{...C.btn,...C.sec,flex:1}} onClick={()=>setOnboard(p=>({...p,step:0}))}>← Артқа</button>
                <button style={{...C.btn,...C.pri,flex:2,opacity:onboard.subjects.length===0?0.5:1}} onClick={()=>{
                  if(!onboard.subjects.length)return showToast("Кем дегенде 1 пән таңдаңыз","err");
                  setOnboard(p=>({...p,step:2}));
                }}>Растауға өту →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Confirm subjects ── */}
          {s===2&&(
            <div>
              <h2 style={{fontWeight:900,fontSize:20,marginBottom:4,color:"#1E1B4B"}}>✅ Таңдауды растаңыз</h2>
              <p style={{color:"#9CA3AF",fontSize:13,marginBottom:16}}>Пәндерді өзгертуге болады</p>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {onboard.subjects.map(sid=>{
                  const sub=SUBJECTS.find(x=>x.id===sid);
                  if(!sub)return null;
                  return(
                    <div key={sid} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:12,
                      background:sub.bg,border:`2px solid ${sub.color}`}}>
                      <div style={{width:34,height:34,borderRadius:9,background:sub.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{sub.icon}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13,color:sub.color}}>{sub.name}</div>
                        {MANDATORY_SUBS.includes(sid)&&<div style={{fontSize:10,color:"#F59E0B",fontWeight:700}}>📌 Міндетті ҰБТ пәні</div>}
                      </div>
                      <button onClick={()=>setOnboard(p=>({...p,subjects:p.subjects.filter(x=>x!==sid)}))}
                        style={{background:"rgba(239,68,68,0.1)",color:"#EF4444",border:"none",borderRadius:8,cursor:"pointer",padding:"4px 10px",fontSize:13,fontWeight:700}}>✕</button>
                    </div>
                  );
                })}
              </div>
              <button style={{...C.btn,background:"#EEF2FF",color:"#4F46E5",width:"100%",padding:10,marginBottom:14,fontSize:13,borderRadius:12}} onClick={()=>setOnboard(p=>({...p,step:1}))}>
                + Пән қосу / өзгерту
              </button>
              <div style={{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",borderRadius:16,padding:"14px 18px",marginBottom:14}}>
                <div style={{color:"rgba(255,255,255,0.7)",fontSize:12}}>Жалпы төлем:</div>
                <div style={{color:"#fff",fontWeight:900,fontSize:26,lineHeight:1.2}}>{price.toLocaleString()} ₸</div>
                <div style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginTop:2}}>{onboard.subjects.length} пән • Толық қол жетімділік</div>
              </div>
              <button style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15,marginBottom:8}} onClick={()=>{
                  const uc=genCode();
                  // Save pending user so admin can see the unlock code
                  const pendingUser={id:"pending_"+Date.now(),name:onboard.name,email:onboard.email,
                    phone:onboard.phone,grade:onboard.grade,subjects:onboard.subjects,
                    plan:"pending",status:"pending",unlockCode:uc,
                    createdAt:new Date().toLocaleDateString("kk-KZ"),role:"student",
                    price:price
                  };
                  // Remove any previous pending for same email
                  setUsers(prev=>[...prev.filter(u=>!(u.status==="pending"&&u.email===onboard.email)),pendingUser]);
                  setOnboard(p=>({...p,step:3,unlockCode:uc}));
                  sbUpsertUser(pendingUser); // sync to Supabase so admin sees the code from any device
                }}>
                💳 Төлемге өту →
              </button>
              <button style={{...C.btn,background:"#F5F5F5",color:"#9CA3AF",width:"100%",padding:10,fontSize:13,borderRadius:12}} onClick={handleFreeReg}>
                Кейін төлеймін (тегін 1 сабақ)
              </button>
            </div>
          )}

          {/* ── STEP 3: QR Payment + 6-digit code ── */}
          {s===3&&(
            <div>
              <h2 style={{fontWeight:900,fontSize:20,marginBottom:4,color:"#1E1B4B"}}>💳 Төлем жасаңыз</h2>
              <p style={{color:"#9CA3AF",fontSize:13,marginBottom:14}}>QR арқылы Kaspi-ге аудару</p>

              {/* Price summary */}
              <div style={{background:"#EEF2FF",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,color:"#4F46E5",fontWeight:700}}>{onboard.subjects.length} пән</div>
                <div style={{fontWeight:900,fontSize:20,color:"#1E1B4B"}}>{price.toLocaleString()} ₸</div>
              </div>

              {/* QR */}
              <div style={{background:"#F8FAFF",border:"2px dashed #C7D2FE",borderRadius:16,padding:20,textAlign:"center",marginBottom:12}}>
                <div style={{textAlign:"center"}}>
                  <img src="data:image/png;base64,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" alt="Kaspi QR" style={{width:190,height:190,borderRadius:12,display:"block",margin:"0 auto 8px"}}/>
                </div>
                <div style={{fontWeight:800,fontSize:14,color:"#1E1B4B",marginBottom:6}}>Kaspi QR — Ип Нұртай</div>
                <div style={{fontSize:12,color:"#6B7280",lineHeight:1.8}}>
                  Kaspi → «Сканерлеу» → QR-ды ұстаңыз<br/>
                  Нөмір: <b style={{color:"#4F46E5"}}>{WA}</b><br/>
                  Сома: <b style={{color:"#EF4444",fontSize:15}}>{price.toLocaleString()} ₸</b>
                </div>
              </div>



              {/* WhatsApp */}
              <div style={{background:"#F0FFF4",border:"1px solid #86EFAC",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>📲 WhatsApp-қа жіберіңіз:</div>
                <a href={"https://wa.me/"+WA.replace(/[^0-9]/g,"")+"?text="+encodeURIComponent("Сәлем! SmartUBT-қа төлем жасадым. Атым: "+(onboard.name||user?.name||"")+" Email: "+(onboard.email||user?.email||""))}
                  target="_blank" rel="noopener"
                  style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",
                    borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:14,textDecoration:"none"}}>
                  <span style={{fontSize:20}}>💬</span> WhatsApp → {WA}
                </a>
              </div>

              {/* 6-digit code input */}
              <div style={{background:"#FFFBEB",border:"2px solid #FCD34D",borderRadius:14,padding:"14px"}}>
                <div style={{fontWeight:800,fontSize:14,marginBottom:4}}>✅ Менеджер растаған соң кодты енгізіңіз</div>
                <div style={{fontSize:12,color:"#92400E",marginBottom:12,lineHeight:1.6}}>
                  Чекті жіберген соң менеджер сізге WhatsApp арқылы <b>6 орынды код</b> жібереді. Сол кодты төменге енгізіңіз.
                </div>
                <div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:12}}>
                  {[0,1,2,3,4,5].map(i=>(
                    <input key={i} id={"rc"+i} maxLength={1}
                      value={(onboard.codeInput||"      ")[i]==="  "[0]?"":(onboard.codeInput||"")[i]||""}
                      onChange={e=>{
                        const v=e.target.value.replace(/[^0-9A-Za-z]/g,"").toUpperCase();
                        const arr=(onboard.codeInput||"      ").split("");
                        arr[i]=v||" ";
                        setOnboard(p=>({...p,codeInput:arr.join("")}));
                        if(v&&i<5)document.getElementById("rc"+(i+1))?.focus();
                      }}
                      onKeyDown={e=>{
                        if(e.key==="Backspace"){
                          const arr=(onboard.codeInput||"      ").split("");
                          arr[i]=" ";
                          setOnboard(p=>({...p,codeInput:arr.join("")}));
                          if(i>0)document.getElementById("rc"+(i-1))?.focus();
                        }
                      }}
                      style={{width:42,height:50,textAlign:"center",fontSize:22,fontWeight:900,
                        borderRadius:10,border:"2px solid #FCD34D",background:"#fff",
                        outline:"none",fontFamily:"inherit",textTransform:"uppercase"}}/>
                  ))}
                </div>
                <button style={{...C.btn,...C.pri,width:"100%",padding:13,fontSize:15}} onClick={handleCode}>
                  ✅ Кодты растап, Премиум ашу
                </button>
              </div>

              <div style={{display:"flex",gap:8,marginTop:10}}>
                <button style={{...C.btn,...C.sec,flex:1,fontSize:13}} onClick={()=>setOnboard(p=>({...p,step:2}))}>← Артқа</button>
                <button style={{...C.btn,background:"#F5F5F5",color:"#9CA3AF",flex:1,fontSize:13}} onClick={handleFreeReg}>Кейін төлеймін</button>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: LOGIN
  ════════════════════════════════════════════════════════ */
  const PageLogin=()=>(
    <div style={{minHeight:"100vh",background:darkMode?"#0F0F1A":"#F0F2FF",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...C.card,width:"100%",maxWidth:"min(420px,100%)",padding:"clamp(20px,5vw,36px)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44}}>⚡</div>
          <h2 style={{fontWeight:900,fontSize:24,color:"#1E1B4B",marginBottom:4}}>Кіру</h2>
          <p style={{color:"#9CA3AF"}}>Smart UBT аккаунтыңызға кіріңіз</p>
        </div>
        <input type="email" placeholder="Email" value={loginForm.email} onChange={e=>{setLoginErr("");setLoginForm(p=>({...p,email:e.target.value}));}} style={{...C.input,marginBottom:12}}/>
        <div style={{position:"relative",marginBottom:24}}>
          <input type={showPw?"text":"password"} placeholder="Құпия сөз" value={loginForm.password}
            onChange={e=>{setLoginErr("");setLoginForm(p=>({...p,password:e.target.value}));}}
            style={{...C.input,paddingRight:44}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
          <button onClick={()=>setShowPw(p=>!p)}
            style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
              background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#9CA3AF",padding:4}}>
            {showPw?"🙈":"👁️"}
          </button>
        </div>
        {loginErr&&<div role="alert" style={{background:"#FEF2F2",border:"1px solid #FCA5A5",color:"#B91C1C",borderRadius:12,padding:"10px 14px",fontSize:13,fontWeight:700,lineHeight:1.5,marginTop:-8,marginBottom:14}}>⚠️ {loginErr}</div>}
        <button disabled={loginBusy} style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15,opacity:loginBusy?0.7:1}} onClick={doLogin}>{loginBusy?"Тексеріліп жатыр...":"Кіру →"}</button>
        <div style={{textAlign:"center",marginTop:10}}>
          <span onClick={doForgotPassword} style={{fontSize:12,color:"#6366F1",cursor:"pointer",fontWeight:600}}>Құпия сөзді ұмыттыңыз ба?</span>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:14,color:"#9CA3AF"}}>
          Аккаунт жоқ? <span style={{color:"#4F46E5",cursor:"pointer",fontWeight:700}} onClick={()=>setPage("register")}>Тіркелу</span>
        </div>
        <div style={{marginTop:20,background:"#EEF2FF",borderRadius:12,padding:14,fontSize:12,color:"#6B7280",lineHeight:1.8}}>
          🔑 Аккаунтыңыз болса кіріңіз немесе тіркелу батырмасын басыңыз
        </div>
        <button style={{...C.btn,background:"transparent",color:"#9CA3AF",width:"100%",marginTop:8}} onClick={()=>setPage("welcome")}>← Басқа бетке</button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════
     LAYOUT WRAPPER
  ════════════════════════════════════════════════════════ */
  const Layout=({children})=>{
    const navItems=[
      {p:"home",l:"Басты",i:"🏠"},
      {p:"subjects",l:"Пәндер",i:"📚"},
      {p:"ai",l:"AI",i:"🤖"},
      {p:"stats",l:"Статистика",i:"📊"},
      {p:"plan",l:"Жоспар",i:"📅"},
      ...(user?.role==="admin"||user?.role==="curator"||user?.role==="superadmin"?[{p:"admin",l:"Басқару",i:"⚙️"},{p:"ubt",l:"ҰБТ",i:"🎓"}]:[]),
    ];
    const bottomNav=[
      {p:"home",i:"🏠",l:"Басты"},
      {p:"subjects",i:"📚",l:"Пәндер"},
      {p:"ai",i:"🤖",l:"AI"},
      {p:"leaderboard",i:"🏆",l:"Рейтинг"},
      {p:"stats",i:"📊",l:"Стат"},
      ...(user?.role==="admin"||user?.role==="curator"||user?.role==="superadmin"?[{p:"admin",i:"⚙️",l:"Админ"}]:[]),
    ];
    return(
      <div style={{
        minHeight:"100dvh",
        background:darkMode?"#0F0F1A":"#F0F2FF",
        fontFamily:"'Plus Jakarta Sans',system-ui,-apple-system,sans-serif",
        WebkitFontSmoothing:"antialiased",
        overflowX:"hidden",
        position:"relative",
      }}>
        {/* ── TOP NAV ── */}
        <nav style={{
          background:darkMode?"#1A1A2E":"#fff",
          borderBottom:darkMode?"1px solid rgba(255,255,255,0.08)":"1px solid #EEF0FF",
          padding:"0 clamp(12px,3vw,24px)",
          height:58,
          display:page==="admin"?"none":"flex",
          alignItems:"center",
          justifyContent:"space-between",
          position:"sticky",
          top:0,
          zIndex:300,
          boxShadow:"0 2px 16px rgba(79,70,229,0.07)",
          boxSizing:"border-box",
          width:"100%",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:"clamp(17px,4vw,22px)",fontWeight:900,background:"linear-gradient(135deg,#4F46E5,#EC4899)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",cursor:"pointer"}} onClick={()=>setPage("home")}>⚡ Smart UBT</div>
          </div>
          {/* Desktop nav links */}
          <div className="desktop-only" style={{display:"flex",gap:2,alignItems:"center",overflow:"hidden"}}>
            {navItems.map(n=>(
              <button key={n.p} onClick={()=>setPage(n.p)}
                style={{...C.btn,padding:"7px 12px",fontSize:13,background:page===n.p?"#EEF2FF":"transparent",color:page===n.p?"#4F46E5":"#6B7280",fontWeight:page===n.p?800:500,borderRadius:10}}>
                {n.i} {n.l}
              </button>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{position:"relative",cursor:"pointer"}} onClick={()=>setNotifOpen(p=>!p)}>
              <div style={{...C.btn,padding:"8px 10px",background:notifOpen?"#EEF2FF":"transparent",color:"#6B7280",borderRadius:10,fontSize:18}}>🔔</div>
              {unreadNotifs>0&&<div style={{position:"absolute",top:2,right:2,width:16,height:16,background:"#EF4444",borderRadius:"50%",fontSize:10,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadNotifs}</div>}
            </div>
            <button onClick={()=>{
              const reports=content.reports||[];
              if(reports.length>0)showToast(`${reports.length} жаңа хабарлама бар`);
              else showToast("Хабарлама жоқ");
            }} style={{
              background:"none",border:`1px solid ${darkMode?"rgba(255,255,255,0.2)":"#EEF0FF"}`,
              borderRadius:10,padding:"6px 10px",cursor:"pointer",fontSize:16,marginRight:4,
              position:"relative",color:darkMode?"#E2E8FF":"#6B7280"
            }}>
              🔔
              {(content.reports||[]).length>0&&(
                <span style={{position:"absolute",top:-4,right:-4,background:"#EF4444",color:"#fff",
                  borderRadius:99,width:16,height:16,fontSize:9,fontWeight:900,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {(content.reports||[]).length}
                </span>
              )}
            </button>
            <button onClick={()=>setDarkMode(d=>!d)}
              title={darkMode?"Жарық режим":"Қараңғы режим"}
              style={{...C.btn,...C.sec,padding:"8px 10px",fontSize:16,borderRadius:10,lineHeight:1}}>
              {darkMode?"☀️":"🌙"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:8,background:darkMode?"rgba(99,102,241,0.2)":"#EEF2FF",borderRadius:12,padding:"6px 12px",cursor:"pointer"}} onClick={()=>setPage("profile")}>
              <span style={{fontSize:20}}>{user?.avatar||"👤"}</span>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"#1E1B4B"}}>{user?.name?.split(" ")[0]}</div>
                <div style={{fontSize:10,color:"#9CA3AF"}}>{user?.plan?.toUpperCase()} • {user?.xp||0} XP</div>
              </div>
            </div>
            <button style={{...C.btn,...C.danger,padding:"7px 12px",fontSize:13}} onClick={doLogout}>Шығу</button>
          </div>
        </nav>

        {/* Notification dropdown */}
        {notifOpen&&(
          <div style={{position:"fixed",top:66,right:20,width:320,maxWidth:"calc(100vw - 32px)",background:"#fff",borderRadius:16,boxShadow:"0 12px 40px rgba(0,0,0,0.15)",border:"1px solid #EEF0FF",zIndex:400,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #EEF0FF",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:800,fontSize:15}}>🔔 Хабарландырулар</div>
              <button style={{...C.btn,background:"transparent",color:"#4F46E5",fontSize:12,padding:"4px 8px"}} onClick={()=>{updateUser({notifications:(user?.notifications||[]).map(n=>({...n,read:true}))});setNotifOpen(false);}}>Барлығын оқыдым</button>
            </div>
            <div style={{maxHeight:300,overflowY:"auto"}}>
              {(user?.notifications||[]).length===0&&<div style={{padding:20,textAlign:"center",color:"#9CA3AF"}}>Хабарландыру жоқ</div>}
              {(user?.notifications||[]).map((n,i)=>(
                <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #F5F7FF",background:n.read?"#fff":"#F0F2FF"}}>
                  <div style={{fontWeight:n.read?400:700,fontSize:13,color:"#1E1B4B"}}>{n.text}</div>
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{n.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main style={{
          padding:page==="admin"?"0":"clamp(10px,3vw,20px) clamp(10px,3vw,16px) calc(72px + env(safe-area-inset-bottom,0px))",
          maxWidth:page==="admin"?"100%":"min(1280px,100%)",
          margin:"0 auto",
          width:"100%",
          boxSizing:"border-box",
          minHeight:"calc(100dvh - 58px)",
        }}>
          <div key={page} style={{animation:"fadeUp 0.25s ease"}}>{children}</div>
        </main>

        {/* ── BOTTOM NAV (mobile) ── */}
        <nav style={{
          position:"fixed",bottom:0,left:0,right:0,zIndex:300,
          background:darkMode?"#1A1A2E":"#fff",borderTop:darkMode?"1px solid rgba(255,255,255,0.08)":"1px solid #EEF0FF",
          display:page==="admin"?"none":"flex",alignItems:"stretch",
          paddingBottom:"env(safe-area-inset-bottom,0px)",
          boxShadow:"0 -4px 20px rgba(79,70,229,0.10)",
        }}>
          {bottomNav.map(n=>(
            <button key={n.p} onClick={()=>setPage(n.p)} style={{
              flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:2,padding:"8px 0 6px",border:"none",cursor:"pointer",
              background:page===n.p?(darkMode?"rgba(99,102,241,0.2)":"#EEF2FF"):"transparent",
              color:page===n.p?"#4F46E5":darkMode?"#6B7280":"#9CA3AF",
              fontFamily:"inherit",transition:"all 0.15s",minWidth:0,
            }}>
              <span style={{position:"relative",lineHeight:1}}>
                <span style={{fontSize:20}}>{n.i}</span>
                {n.p==="admin"&&(content.reports||[]).length>0&&(
                  <span style={{position:"absolute",top:-4,right:-6,background:"#EF4444",color:"#fff",
                    fontSize:9,fontWeight:900,borderRadius:"50%",minWidth:14,height:14,
                    display:"flex",alignItems:"center",justifyContent:"center",padding:"0 2px"}}>
                    {(content.reports||[]).length}
                  </span>
                )}
              </span>
              <span style={{fontSize:10,fontWeight:page===n.p?800:500,letterSpacing:0.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>{n.l}</span>
              {page===n.p&&<div style={{width:20,height:3,borderRadius:99,background:"#4F46E5",marginTop:1}}/>}
            </button>
          ))}
        </nav>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: HOME DASHBOARD
  ════════════════════════════════════════════════════════ */
  const PageHome=()=>{
    const streak=user?.streak||0;
    const plan=PLANS.find(p=>p.id===user?.plan)||PLANS[0];
    const todayAnnouncements=content.announcements?.slice(0,3)||[];
    const chemTopics=content.topics?.chemistry||[];
    const allLs=chemTopics.flatMap(t=>t.lessons||[]).filter(l=>/_t\d+$/.test(l.id));  // тек негізгі тақырыптар (§)
    const totalLessons=allLs.length||1;
    const doneLessons=allLs.filter(lessonDoneOf).length;
    const prepPct=Math.min(100,Math.round((doneLessons/totalLessons)*100));

    return(
      <div>
        {/* SuperAdmin quick access banner */}
        {(user?.role==="superadmin"||user?.role==="admin")&&(
          <div onClick={()=>setPage("admin")} style={{background:"linear-gradient(135deg,#1E1B4B,#4F46E5)",borderRadius:16,padding:"14px 18px",marginBottom:14,display:"flex",alignItems:"center",gap:12,cursor:"pointer",border:"2px solid #4F46E5"}}>
            <span style={{fontSize:28}}>{user?.role==="superadmin"?"🚀":"⚙️"}</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,fontSize:15,color:"#fff"}}>{user?.role==="superadmin"?"Супер Админ панелі":"Админ панелі"}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>Оқушыларды, контентті және баптауларды басқару →</div>
            </div>
            <div style={{background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"8px 14px",color:"#fff",fontWeight:700,fontSize:13}}>Ашу →</div>
          </div>
        )}
        {/* Welcome hero */}
        <div style={{background:"linear-gradient(135deg,#4F46E5 0%,#7C3AED 50%,#BE185D 100%)",borderRadius:24,padding:"20px 16px 18px",marginBottom:16,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,background:"rgba(255,255,255,0.08)",borderRadius:"50%"}}/>
          <div style={{position:"absolute",bottom:-20,right:80,width:100,height:100,background:"rgba(255,255,255,0.06)",borderRadius:"50%"}}/>
          <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={{color:"rgba(255,255,255,0.7)",fontSize:13,marginBottom:6}}>👋 Сәлем,</div>
              <h1 style={{fontSize:26,fontWeight:900,color:"#fff",marginBottom:8,letterSpacing:-0.5}}>{user?.name} {user?.avatar}</h1>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <div style={{background:streak>=7?"rgba(245,158,11,0.35)":"rgba(255,255,255,0.18)",borderRadius:12,padding:"6px 14px",color:"#fff",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:6,border:streak>=7?"2px solid rgba(252,211,77,0.5)":"none"}}>
                  {streak>=30?"🔥🔥🔥":streak>=7?"🔥🔥":"🔥"} {streak} күн{streak>=7?" — керемет!":""}
                </div>
                <div style={{background:"rgba(255,255,255,0.15)",borderRadius:12,padding:"6px 14px",color:"#fff",fontSize:13,fontWeight:700}}>
                  ⭐ {user?.xp||0} XP
                </div>
                <div style={{background:plan.id==="premium"?"rgba(245,158,11,0.3)":"rgba(255,255,255,0.12)",borderRadius:12,padding:"6px 14px",color:"#fff",fontSize:13,fontWeight:700}}>
                  {plan.id==="premium"?"👑":"📦"} {plan.name}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,flexShrink:0}}>
            <div style={{textAlign:"center",background:"rgba(255,255,255,0.15)",borderRadius:18,padding:"14px 20px"}}>
              <div style={{fontSize:32,fontWeight:900,color:"#fff"}}>{avgScore}%</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>Орт. балл</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:1}}>{myResults.length} тест</div>
            </div>
            <div style={{textAlign:"center",background:"rgba(255,255,255,0.12)",borderRadius:18,padding:"14px 20px",minWidth:90}}>
              {(()=>{
                const now=new Date();
                const ubt=new Date(ubtDate);
                const diff=ubt-now;
                const days=Math.max(0,Math.ceil(diff/86400000));
                const hrs=Math.max(0,Math.floor((diff%86400000)/3600000));
                const urgent=days<=30;
                return <>
                  <div style={{fontSize:28,fontWeight:900,color:urgent?"#FCD34D":"#fff",lineHeight:1}}>{days}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>күн</div>
                  {days<=7&&<div style={{fontSize:10,color:"#FCD34D",fontWeight:700}}>{hrs}сағ</div>}
                  <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:1}}>ҰБТ-ға</div>
                </>;
              })()}
            </div>
          </div>
          </div>
        </div>

        {/* Weekly plan alert on home */}
        {user?.studyPlan&&(()=>{
          const wp=checkWeeklyProgress(user.studyPlan);
          if(!wp||wp.pct>=100)return null;
          return(
            <div style={{background:"linear-gradient(135deg,#FFFBEB,#FEF3C7)",borderRadius:16,padding:"14px 20px",marginBottom:16,border:"2px solid #FCD34D",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setPage("plan")}>
              <span style={{fontSize:28}}>📅</span>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,color:"#92400E"}}>{wp.cw}-апта жоспары • {wp.doneLessons}/{wp.total} сабақ</div>
                <div style={{background:"#FDE68A",borderRadius:99,height:6,marginTop:6}}>
                  <div style={{background:"#F59E0B",height:6,borderRadius:99,width:wp.pct+"%",transition:"width 0.8s"}}/>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:900,color:wp.pct>=80?"#22C55E":"#F59E0B",fontSize:20}}>{wp.pct}%</div>
                {wp.pct<80&&<div style={{fontSize:10,color:"#EF4444",fontWeight:700}}>⚠️ Аяқтаңыз</div>}
                <div style={{fontSize:11,color:"#9CA3AF"}}>Жоспар →</div>
              </div>
            </div>
          );
        })()}
        {/* Химия — басты карта (жалғыз пән) */}
        <div onClick={()=>{setSubjectId("chemistry");setPage("lessons")}} style={{position:"relative",overflow:"hidden",borderRadius:24,padding:"24px 22px",marginBottom:16,cursor:"pointer",background:"linear-gradient(135deg,#047857 0%,#10B981 55%,#34D399 100%)",color:"#fff",boxShadow:"0 12px 32px rgba(16,185,129,0.35)"}}>
          <div style={{position:"absolute",right:-40,top:-40,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,0.12)"}}/>
          <div style={{position:"absolute",right:30,bottom:-60,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,0.08)"}}/>
          <div style={{position:"relative",display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
            <div style={{width:76,height:76,borderRadius:22,background:"rgba(255,255,255,0.22)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:42,flexShrink:0}}>🧪</div>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:900,fontSize:28,lineHeight:1.1}}>Химия</div>
              <div style={{fontSize:13,opacity:0.9,marginTop:4}}>{chemTopics.length||31} тарау • {totalLessons} тақырып</div>
            </div>
          </div>
          <div style={{position:"relative",display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginBottom:6}}>
            <span>Прогресс: {doneLessons}/{totalLessons} тақырып</span><span>{prepPct}%</span>
          </div>
          <div style={{position:"relative",background:"rgba(255,255,255,0.28)",borderRadius:99,height:10,marginBottom:18}}>
            <div style={{background:"#fff",height:10,borderRadius:99,width:`${prepPct}%`,transition:"width 0.8s"}}/>
          </div>
          <div style={{position:"relative",background:"#fff",color:"#047857",borderRadius:14,padding:"13px 0",textAlign:"center",fontWeight:900,fontSize:15}}>
            {doneLessons>0?"Оқуды жалғастыру →":"Оқуды бастау →"}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
          {[
            {l:"Тесттер",v:myResults.length,i:"📝",g:"linear-gradient(135deg,#6366F1,#8B5CF6)"},
            {l:"Орташа балл",v:avgScore+"%",i:"🎯",g:"linear-gradient(135deg,#EC4899,#F43F5E)"},
            {l:"Дайындық",v:prepPct+"%",i:"📊",g:"linear-gradient(135deg,#F59E0B,#F97316)"},
            {l:"Сабақ бітірілді",v:doneLessons,i:"✅",g:"linear-gradient(135deg,#10B981,#14B8A6)"},
          ].map((st,i)=>(
            <div key={i} style={{background:st.g,borderRadius:18,padding:"16px 14px",textAlign:"center",color:"#fff",boxShadow:"0 6px 18px rgba(0,0,0,0.12)"}}>
              <div style={{fontSize:26}}>{st.i}</div>
              <div style={{fontSize:26,fontWeight:900,lineHeight:1.2}}>{st.v}</div>
              <div style={{fontSize:12,fontWeight:600,opacity:0.92}}>{st.l}</div>
            </div>
          ))}
        </div>

        {/* Quick action buttons */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
          {[
            {i:"🎴",l:"Флэшкарта",p:"flashcard",bg:"linear-gradient(135deg,#7C3AED,#9333EA)"},
            {i:"🏆",l:"Рейтинг",p:"leaderboard",bg:"linear-gradient(135deg,#F59E0B,#D97706)"},
            {i:"📅",l:"Жоспар",p:"plan",bg:"linear-gradient(135deg,#0EA5E9,#0284C7)"},
            {i:"🤖",l:"AI Мұғалім",p:"ai",bg:"linear-gradient(135deg,#22C55E,#16A34A)"},
          ].map(({i,l,p,bg})=>(
            <div key={p} onClick={()=>setPage(p)} style={{background:bg,borderRadius:14,padding:"12px 8px",textAlign:"center",cursor:"pointer",boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
              <div style={{fontSize:22,marginBottom:4}}>{i}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#fff",lineHeight:1.2}}>{l}</div>
            </div>
          ))}
        </div>
        {/* ҰБТ Симуляция баннері */}
        <div onClick={()=>setPage("ubt")} style={{background:"linear-gradient(135deg,#1E1B4B 0%,#4F46E5 60%,#7C3AED 100%)",borderRadius:16,padding:"18px 22px",marginBottom:20,cursor:"pointer",display:"flex",alignItems:"center",gap:16,border:"2px solid #4F46E5"}}>
          <div style={{fontSize:44}}>🎓</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:17,color:"#fff"}}>ҰБТ Симуляциясы</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",marginTop:3}}>Химия — 40 сұрақ, <b style={{color:"#FCD34D"}}>50 балл</b>, 240 минут</div>
          </div>
          <div style={{background:"linear-gradient(135deg,#F59E0B,#EF4444)",borderRadius:12,padding:"10px 18px",fontWeight:900,fontSize:14,color:"#fff",whiteSpace:"nowrap",boxShadow:"0 4px 12px rgba(239,68,68,0.4)"}}>
            Бастау →
          </div>
        </div>

        {todayAnnouncements.length>0&&(
          <div style={{...C.card,marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #EEF0FF",fontWeight:800,fontSize:16}}>📢 Хабарландырулар</div>
            <div style={{padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8}}>
              {todayAnnouncements.slice(0,4).map((a,i)=>(
                <div key={i} style={{borderRadius:12,padding:12,background:a.type==="info"?"#EFF6FF":a.type==="success"?"#F0FFF4":a.type==="warning"?"#FFFBEB":"#FEF2F2",cursor:"pointer"}}>
                  {a.pinned&&<div style={{fontSize:10,fontWeight:700,color:"#F59E0B",marginBottom:4}}>📌 БЕКІТІЛГЕН</div>}
                  <div style={{fontWeight:700,fontSize:12,color:"#1E1B4B",marginBottom:2}}>{a.title}</div>
                  <div style={{fontSize:11,color:"#6B7280",lineHeight:1.4}}>{a.body.substring(0,60)}...</div>
                  <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>{a.author} • {a.date}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent results + AI CTA */}
        <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:16}}>
          <div style={C.card}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #EEF0FF",fontWeight:800,fontSize:16}}>📋 Соңғы нәтижелер</div>
            {myResults.length===0&&<div style={{padding:24,textAlign:"center",color:"#9CA3AF"}}>Нәтиже жоқ</div>}
            {myResults.slice(0,5).map((r,i)=>(
              <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid #F5F7FF",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>{SUBJECTS.find(s=>s.id===r.sid)?.icon}</span>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.subjectName}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{r.date}</div></div>
                <div style={{fontWeight:900,color:r.score>=80?"#22C55E":r.score>=60?"#F59E0B":"#EF4444"}}>{r.score}%</div>
                {r.wrong?.length>0&&<button style={{...C.btn,...C.sec,fontSize:11,padding:"4px 10px"}} onClick={()=>startTest(r.sid,r.wrong)}>🔄 Қате</button>}
              </div>
            ))}
          </div>
          <div style={{...C.card,background:"linear-gradient(135deg,#EEF2FF,#FDF2FF)",display:"flex",flexDirection:"column",gap:12,padding:20}}>
            <div style={{fontSize:48,textAlign:"center"}}>🤖</div>
            <div style={{fontWeight:900,fontSize:17,textAlign:"center",color:"#1E1B4B"}}>AI Мұғалім</div>
            <div style={{color:"#6B7280",fontSize:13,textAlign:"center",lineHeight:1.5}}>Кез-келген сұрақты қазақша сұра — дереу жауап</div>
            <button style={{...C.btn,...C.pri,marginTop:"auto"}} onClick={()=>setPage("ai")}>Сұрақ қою →</button>
            <div style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>AI: {PLANS.find(p=>p.id===user?.plan)?.features[2]||"5 сұрақ/күн"}</div>
          </div>
        </div>
      {/* Recent activity */}
        {myResults.length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontWeight:800,fontSize:16}}>⚡ Соңғы нәтижелер</div>
              <button onClick={()=>setPage("stats")} style={{background:"none",border:"none",cursor:"pointer",color:"#4F46E5",fontWeight:700,fontSize:13}}>Барлығы →</button>
            </div>
            {myResults.slice(0,3).map((r,i)=>{
              const s=SUBJECTS.find(x=>x.id===r.sid);
              return(
                <div key={i} style={{...C.card,padding:"12px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:12,background:s?.bg||"#EEF0FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{s?.icon||"📚"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13}}>{r.subjectName}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{r.date} • {r.correct}/{r.total} дұрыс</div>
                  </div>
                  <div style={{fontWeight:900,fontSize:18,color:r.score>=80?"#22C55E":r.score>=60?"#F59E0B":"#EF4444"}}>{r.score}%</div>
                  {r.score>=70&&<button onClick={()=>setCertModal(r)} style={{background:"none",border:"1px solid #FCD34D",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer",color:"#D97706"}}>🏅</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: SUBJECTS
  ════════════════════════════════════════════════════════ */
  const PageSubjects=()=>{
    const filter=subjectFilter; const setFilter=setSubjectFilter;
    const filtered=SUBJECTS; /* жалғыз пән — химия */
    const _unusedFilter=filter==="mine"?(user?.subjects||[]).map(id=>SUBJECTS.find(s=>s.id===id)).filter(Boolean):filter==="mandatory"?SUBJECTS.filter(s=>s.tag==="Міндетті"):filter==="profile"?SUBJECTS.filter(s=>s.tag==="Бейінді"):SUBJECTS;
    return(
      <div>
        <h2 style={{fontWeight:900,fontSize:24,color:"#1E1B4B",marginBottom:16}}>🧪 Химия</h2>
        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14}}>
          {filtered.map(s=>{
            const sRes=myResults.filter(r=>r.sid===s.id);
            const sAvg=sRes.length?Math.round(sRes.reduce((a,b)=>a+b.score,0)/sRes.length):0;
            const isMine=(user?.subjects||[]).includes(s.id);
            return(
              <div key={s.id} style={{...C.card,padding:0,overflow:"hidden",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 8px 28px ${s.color}25`}}
                onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 2px 20px rgba(79,70,229,0.08)"}}>
                <div style={{height:5,background:s.color}}/>
                <div style={{padding:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div style={{fontSize:56}}>{s.icon}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>

                    </div>
                  </div>
                  <div style={{fontWeight:900,fontSize:24,color:"#1E1B4B",marginBottom:8}}>{s.name}</div>
                  {sAvg>0&&<div style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                      <span style={{fontSize:10,color:"#9CA3AF"}}>Орт. балл</span>
                      <span style={{fontSize:10,fontWeight:700,color:s.color}}>{sAvg}%</span>
                    </div>
                    <div style={{background:"#EEF0FF",borderRadius:99,height:5}}>
                      <div style={{background:s.color,height:5,borderRadius:99,width:`${sAvg}%`}}/>
                    </div>
                  </div>}
                  <div style={{fontSize:14,color:"#6B7280",marginBottom:14}}>{(content.topics[s.id]||[]).length} тарау • {(content.topics[s.id]||[]).reduce((a,t)=>a+(t.lessons||[]).filter(l=>/_t\d+$/.test(l.id)).length,0)} тақырып</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:6}}>
                    <button onClick={()=>{setSubjectId(s.id);setPage("lessons")}} style={{...C.btn,...C.sec,padding:"14px 0",fontSize:15,fontWeight:800}}>📹 Сабақтар</button>
                    <button onClick={()=>setPage("ubt")} style={{...C.btn,...C.pri,padding:"14px 0",fontSize:15,fontWeight:800}}>🎓 ҰБТ симуляциясы</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: LESSONS (topic list)
  ════════════════════════════════════════════════════════ */
  const isEnrolledFor=(sid)=>user?.role==="superadmin"||user?.role==="admin"||user?.plan==="premium"||user?.plan==="basic"||(user?.plan==="package"&&(PACKAGES.find(p=>p.id===user.packageId)?.subjects||[]).includes(sid));
  const canOpenLesson=(ls,ti,li)=>isEnrolledFor(subjectId)||(user?.plan==="free"&&ti===0&&li===0)||(content.unlockedLessons?.[subjectId]||[]).includes(ls.id)||!!ls.isFree||!!lessonMedia[ls.id]?.is_free;
  // Сабақ аяқталды ма (видео көрілді немесе видео жоқ + теория оқылды; тарау тесті — өту деңгейі)
  const lessonDoneOf=(ls)=>{
    const lp=user?.lessonProgress?.[ls.id]||{};
    if(isReviewId(ls.id))return (lp.bekituScore||0)>=REVIEW_PASS;
    return (!!lp.videoWatched||!videoUrlOf(ls))&&!!lp.konspektDone;
  };
  const PageLessons=()=>{
    const sub=SUBJECTS.find(s=>s.id===subjectId);
    const tops=(content.topics||{})[subjectId]||[];
    if(!sub)return null;
    const unlockedIds=content.unlockedLessons?.[subjectId]||[];
    const isEnrolled=user?.role==="superadmin"||user?.role==="admin"||user?.plan==="premium"||user?.plan==="basic"||(user?.plan==="package"&&(PACKAGES.find(p=>p.id===user.packageId)?.subjects||[]).includes(subjectId));
    // weekly plan check
    const wp=checkWeeklyProgress(user?.studyPlan);
    return(
      <div>
        {/* Weekly plan warning banner */}
        {user?.studyPlan&&wp&&wp.pct<100&&(
          <div style={{background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",borderRadius:16,padding:"14px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12,border:"2px solid #FCD34D"}}>
            <span style={{fontSize:28}}>⚠️</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,color:"#92400E"}}>{wp.cw}-апталық жоспар: {wp.doneLessons}/{wp.total} сабақ аяқталды</div>
              <div style={{fontSize:13,color:"#B45309"}}>Барлық сабақты аяқтамасаңыз келесі аптаға өтілмейді</div>
            </div>
            <div style={{fontWeight:900,fontSize:22,color:wp.pct>=80?"#22C55E":"#F59E0B"}}>{wp.pct}%</div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setPage("subjects")} style={{...C.btn,...C.sec,padding:"8px 14px"}}>← Артқа</button>
          <div>
            <h2 style={{fontWeight:900,fontSize:20,color:"#1E1B4B"}}>{sub.icon} {sub.name}</h2>
            <div style={{color:"#9CA3AF",fontSize:13}}>Видео • Теория • Қорытынды тест</div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            {!isEnrolled&&<span style={{...C.tag,background:"#FEF3C7",color:"#92400E",padding:"6px 12px"}}>🔒 Тек 1-сабақ ашық</span>}
            <button onClick={()=>setPage("ubt")} style={{...C.btn,...C.pri,padding:"8px 16px",fontSize:13}}>🎓 ҰБТ симуляциясы</button>
          </div>
        </div>
        {tops.map((tp,ti)=>(
          <div key={tp.id} style={{...C.card,marginBottom:14,overflow:"hidden"}}>
            <div style={{background:sub.bg,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:900,fontSize:15,color:sub.color}}>{tp.title}</div>
                <div style={{fontSize:12,color:sub.color+"99"}}>{tp.lessons.filter(lessonDoneOf).length}/{tp.lessons.length} аяқталды</div>
              </div>
              <div style={{...C.tag,background:sub.color,color:"#fff"}}>{tp.lessons.length} сабақ</div>
            </div>
            <div style={{padding:14,display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(160px,45%),1fr))",gap:10}}>
              {tp.lessons.map((ls,li)=>{
                const done=lessonDoneOf(ls);
                const unlocked=canOpenLesson(ls,ti,li);
                return(
                  <div key={ls.id}
                    onClick={()=>{
                      if(!unlocked){setAdminModal({type:"payment"});return;}
                      setTopicId(tp.id);setLessonId(ls.id);setLessonTab(isReviewId(ls.id)?"bekitu":(videoUrlOf(ls)?"video":"konspekt"));setGameMode(null);setPage("lesson");
                    }}
                    style={{background:done?"#F0FFF4":unlocked?"#FAFAFE":"#F5F5F5",borderRadius:14,padding:14,
                      cursor:unlocked?"pointer":"not-allowed",
                      border:`2px solid ${done?'#86EFAC':unlocked?'#EEF0FF':'#E5E7EB'}`,transition:"all 0.2s",position:"relative",
                      opacity:unlocked?1:0.75}}
                    onMouseEnter={e=>{if(unlocked){e.currentTarget.style.background=sub.bg;e.currentTarget.style.borderColor=sub.color;}}}
                    onMouseLeave={e=>{e.currentTarget.style.background=done?"#F0FFF4":unlocked?"#FAFAFE":"#F5F5F5";e.currentTarget.style.borderColor=done?"#86EFAC":unlocked?"#EEF0FF":"#E5E7EB";}}>
                    {done&&<div style={{position:"absolute",top:8,right:8,fontSize:14}}>✅</div>}
                    {!unlocked&&<div style={{position:"absolute",top:8,right:8,fontSize:16}}>🔒</div>}
                    <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                      <div style={{width:34,height:34,borderRadius:10,background:unlocked?sub.color:"#D1D5DB",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:13,flexShrink:0}}>{unlocked?"":"🔒"}</div>
                      <div>
                        <div style={{fontWeight:700,fontSize:13,color:unlocked?"#1E1B4B":"#9CA3AF",lineHeight:1.3}}>{ls.title}</div>
                        {unlocked
                          ?<div style={{fontSize:11,color:"#9CA3AF",marginTop:3}}>⏱ {ls.duration} • {isReviewId(ls.id)?"📝 Тест":(videoUrlOf(ls)?"📹 Видео • 📖 Теория":"📖 Теория")}</div>
                          :<div style={{fontSize:11,color:"#EF4444",marginTop:3,fontWeight:600}}>🔒 Жазылу керек</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!isEnrolled&&(
          <div style={{...C.card,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",padding:24,textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:36,marginBottom:8}}>🔓</div>
            <div style={{fontWeight:900,fontSize:18,color:"#fff",marginBottom:6}}>Барлық сабаққа қол жеткізу</div>
            <div style={{color:"rgba(255,255,255,0.7)",marginBottom:16}}>Жазылу немесе пакет сатып алу</div>
            <button style={{...C.btn,background:"#fff",color:"#4F46E5",padding:"12px 28px",fontWeight:800}} onClick={()=>setAdminModal({type:"payment"})}>
              Жазылу →
            </button>
          </div>
        )}
        <div style={{...C.card,background:"linear-gradient(135deg,#EEF2FF,#FDF2FF)",display:"flex",justifyContent:"space-between",alignItems:"center",padding:20,flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontWeight:900,fontSize:16}}>🎓 {sub.name} — ҰБТ симуляциясы</div>
            <div style={{color:"#6B7280",fontSize:13}}>Нақты ҰБТ форматы • 40 сұрақ • 50 балл</div>
          </div>
          <button style={{...C.btn,...C.pri,padding:"12px 24px"}} onClick={()=>setPage("ubt")}>Бастау →</button>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: SINGLE LESSON
  ════════════════════════════════════════════════════════ */
  const PageLesson=()=>{
    const sub=SUBJECTS.find(s=>s.id===subjectId);
    const tops=(content.topics||{})[subjectId]||[];
    const ti=tops.findIndex(t=>t.id===topicId);
    const topic=tops[ti];
    const lessons=topic?.lessons||[];
    const lidx=lessons.findIndex(l=>l.id===lessonId);
    const lesson=lessons[lidx];
    if(!sub||!lesson)return <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Сабақ табылмады</div>;

    const isReview=isReviewId(lesson.id);
    const lp=user?.lessonProgress?.[lessonId]||{};
    const vurl=videoUrlOf(lesson);
    const videoWatched=!!lp.videoWatched, theoryOk=!!lp.konspektDone;
    const reviewScore=lp.bekituScore||0, reviewOk=reviewScore>=REVIEW_PASS;
    const fullyDone=isReview?reviewOk:((videoWatched||!vurl)&&theoryOk);

    const saveLp=(patch,extra)=>updateUser(prev=>({
      lessonProgress:{...prev.lessonProgress,[lessonId]:{...(prev.lessonProgress?.[lessonId]||{}),...patch}},
      ...(extra?extra(prev):{})
    }));
    // Сабақ толық аяқталса — жалпы прогреске (апталық жоспар, басты бет) жазылады
    const markDone=(patch)=>{
      const nowVideo=(patch.videoWatched??videoWatched)||!vurl;
      const nowTheory=patch.konspektDone??theoryOk;
      saveLp(patch,(prev)=>(nowVideo&&nowTheory)?{progress:{...(prev.progress||{}),[lessonId]:true}}:{});
    };

    const STEPS=isReview?[
      {id:"bekitu",icon:"📝",label:"Қорытынды тест",done:reviewOk},
    ]:(vurl?[
      {id:"video",icon:"📹",label:"Видео",done:videoWatched},
      {id:"konspekt",icon:"📖",label:"Теория",done:theoryOk},
    ]:[
      {id:"konspekt",icon:"📖",label:"Теория",done:theoryOk},
    ]);
    const tab=STEPS.some(s=>s.id===lessonTab)?lessonTab:STEPS[0].id;
    const doneCount=STEPS.filter(s=>s.done).length;

    const lastResult=myResults.filter(r=>r.sid===subjectId&&r.mode==="fix"&&r.lessonId===lessonId).slice(-1)[0];
    const prevLs=lidx>0?lessons[lidx-1]:null;
    const nextLs=lidx<lessons.length-1?lessons[lidx+1]:null;
    const goLesson=(ls)=>{
      const li=lessons.findIndex(x=>x.id===ls.id);
      if(!canOpenLesson(ls,ti,li)){setAdminModal({type:"payment"});return;}
      setLessonId(ls.id);setLessonTab(isReviewId(ls.id)?"bekitu":(videoUrlOf(ls)?"video":"konspekt"));
      try{window.scrollTo({top:0,behavior:"smooth"});}catch(e){}
    };
    const embed=toEmbedUrl(vurl);

    return(
      <div style={{maxWidth:"min(860px,100%)",margin:"0 auto"}}>
        {/* Жол көрсеткіш */}
        <div style={{fontSize:13,color:"#9CA3AF",marginBottom:14,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <span style={{cursor:"pointer",color:"#4F46E5",fontWeight:600}} onClick={()=>setPage("lessons")}>← {topic?.title?.split(".")[0]||sub.name}</span>
          {fullyDone&&<span style={{...C.tag,...C.success,marginLeft:6,fontSize:10}}>🏆 Аяқталды</span>}
        </div>
        <h2 style={{fontWeight:900,fontSize:20,color:"#1E1B4B",lineHeight:1.35,marginBottom:14}}>{lesson.title}</h2>

        {/* Қадамдар */}
        {STEPS.length>1&&(
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {STEPS.map(st=>{
              const active=tab===st.id;
              return(
                <button key={st.id} onClick={()=>setLessonTab(st.id)}
                  style={{...C.btn,flex:1,padding:"11px 14px",fontSize:13,borderRadius:12,
                    border:`2px solid ${active?"#4F46E5":st.done?"#22C55E":"#E5E7EB"}`,
                    background:active?"linear-gradient(135deg,#4F46E5,#7C3AED)":st.done?"#F0FFF4":"#fff",
                    color:active?"#fff":st.done?"#16A34A":"#6B7280",cursor:"pointer"}}>
                  {st.done&&!active?"✅":st.icon} {st.label}
                </button>
              );
            })}
          </div>
        )}

        {/* ══ ВИДЕО ══ */}
        {tab==="video"&&(
          <div>
            <div style={{background:"#1E1B4B",borderRadius:20,overflow:"hidden",marginBottom:16,position:"relative",paddingBottom:"56.25%"}}>
              <iframe src={embed} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={lesson.title}/>
            </div>
            <div style={{...C.card,padding:20}}>
              {!videoWatched?(
                <div>
                  <div style={{background:"#EEF2FF",borderRadius:12,padding:"12px 16px",marginBottom:14,fontSize:13,color:"#4338CA"}}>
                    💡 Видеоны көрген соң <b>«Видеоны аяқтадым»</b> батырмасын басыңыз.
                  </div>
                  <button style={{...C.btn,...C.pri,width:"100%",padding:"13px 0",fontSize:15,fontWeight:800}} onClick={()=>{
                    markDone({videoWatched:true});
                    updateUser(prev=>({xp:(prev.xp||0)+10}));
                    showToast("Видео аяқталды! +10 XP ✅");
                    setLessonTab("konspekt");
                  }}>✅ Видеоны аяқтадым (+10 XP)</button>
                </div>
              ):(
                <div>
                  <div style={{background:"#F0FFF4",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:24}}>✅</span><div style={{fontWeight:700,color:"#22C55E"}}>Видео аяқталды</div>
                  </div>
                  <button style={{...C.btn,...C.pri,width:"100%",padding:"13px 0",fontSize:15}} onClick={()=>setLessonTab("konspekt")}>Теорияға өту →</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ТЕОРИЯ ══ */}
        {tab==="konspekt"&&(
          <div>
            <div style={{...C.card,padding:"22px 22px",marginBottom:16}}>
              <TheoryHtml lessonId={lesson.id} onUpgrade={()=>setAdminModal({type:"payment"})}/>
            </div>
            <div style={{...C.card,padding:20}}>
              {!theoryOk?(
                <button style={{...C.btn,...C.pri,width:"100%",padding:"13px 0",fontSize:15,fontWeight:800}} onClick={()=>{
                  markDone({konspektDone:true});
                  updateUser(prev=>({xp:(prev.xp||0)+10}));
                  showToast("Теория оқылды! +10 XP ✅");
                }}>✅ Оқып шықтым (+10 XP)</button>
              ):(
                <div style={{background:"#F0FFF4",borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>✅</span><div style={{fontWeight:700,color:"#22C55E"}}>Теория оқылды</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ ҚОРЫТЫНДЫ ТЕСТ ══ */}
        {tab==="bekitu"&&(
          <div style={{...C.card,padding:24}}>
            <div style={{fontSize:44,textAlign:"center",marginBottom:8}}>📝</div>
            <div style={{fontWeight:900,fontSize:18,textAlign:"center",color:"#1E1B4B",marginBottom:4}}>40 тапсырма • 50 балл</div>
            <div style={{textAlign:"center",color:"#9CA3AF",fontSize:13,marginBottom:18}}>Уақыты: 60 минут • «Өтті» деңгейі: {REVIEW_PASS}%</div>
            <div style={{background:"#F8FAFF",border:"1px solid #E5E7EB",borderRadius:14,padding:"12px 16px",marginBottom:18,fontSize:13.5,lineHeight:1.9,color:"#1E1B4B"}}>
              {[["1–25","Бір дұрыс жауап","25 балл"],["26–30","Мәтін негізіндегі сұрақтар","5 балл"],["31–35","Сәйкестендіру","10 балл"],["36–40","Бір немесе бірнеше дұрыс жауап","10 балл"]].map(([n,t,b])=>(
                <div key={n} style={{display:"flex",justifyContent:"space-between",gap:10}}><span><b style={{color:"#4F46E5"}}>{n}</b> · {t}</span><span style={{fontWeight:800}}>{b}</span></div>
              ))}
            </div>
            {lastResult&&(
              <div style={{background:reviewOk?"#F0FFF4":"#FFF7ED",border:`1px solid ${reviewOk?"#86EFAC":"#FDBA74"}`,borderRadius:12,padding:"12px 16px",marginBottom:16,fontSize:14,fontWeight:700,color:reviewOk?"#16A34A":"#C2410C"}}>
                {reviewOk?"🏆 Өтілді":"Соңғы нәтиже"}: {lastResult.points!=null&&lastResult.maxPoints?`${lastResult.points}/${lastResult.maxPoints} балл (${lastResult.score}%)`:`${lastResult.score}%`}
                {reviewScore>0&&<span style={{fontWeight:600,opacity:0.8}}> • ең жақсы: {reviewScore}%</span>}
              </div>
            )}
            <button style={{...C.btn,...C.pri,width:"100%",padding:"14px 0",fontSize:16,fontWeight:900}}
              onClick={()=>startLessonTest(subjectId,lessonId,"fix")} disabled={startingTest}>
              {startingTest?"⏳ Жүктелуде...":(lastResult?"🔄 Қайта тапсыру":"▶ Тестті бастау")}
            </button>
          </div>
        )}

        {/* Алдыңғы / келесі сабақ */}
        <div style={{display:"flex",gap:10,marginTop:16,marginBottom:24}}>
          <button disabled={!prevLs} onClick={()=>prevLs&&goLesson(prevLs)}
            style={{...C.btn,...C.sec,flex:1,opacity:prevLs?1:0.4,textAlign:"left",padding:"12px 14px",fontSize:13}}>
            ← {prevLs?"Алдыңғы":"—"}
          </button>
          <button disabled={!nextLs} onClick={()=>nextLs&&goLesson(nextLs)}
            style={{...C.btn,...C.pri,flex:1,opacity:nextLs?1:0.4,textAlign:"right",padding:"12px 14px",fontSize:13}}>
            {nextLs?"Келесі сабақ":"—"} →
          </button>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: TEST
  ════════════════════════════════════════════════════════ */
  const PageTest=()=>{
    if(!test)return null;
    if(test.done||page==="result")return PageResult();
    const{qs,curr,ans,time}=test;
    const q=qs[curr];
    return(
      <div style={{maxWidth:"min(700px,100%)",margin:"0 auto"}}>
        <div style={{...C.card,marginBottom:14,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            {(test.mode==="ubt"||test.review)&&test.sections&&(()=>{
                const sec=test.sections.find(s=>test.curr>=s.start&&test.curr<s.start+s.count);
                return sec?<div style={{fontWeight:800,fontSize:13,color:sec.color||"#4F46E5",marginBottom:2}}>{sec.label} — {test.curr-sec.start+1}/{sec.count}</div>:null;
              })()}
            <div style={{fontWeight:800,fontSize:15,color:"#1E1B4B"}}>{test.mode==="ubt"?"🎓 ҰБТ Симуляциясы":SUBJECTS.find(s=>s.id===test.sid)?.name}
              {test.variantTitle?` — ${test.variantTitle}`:test.mode==="hw"?" — 📝 Үй жұмысы":test.mode==="fix"?(test.review?" — 📝 Қорытынды тест":" — 🔄 Бекіту"):test.mode==="errors"||test.retry?" — 🔄 Қатемен жұмыс":test.mode==="practice"?" — 🎯 Қосымша жаттығу":""}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{color:"#9CA3AF",fontSize:13}}>{curr+1} / {qs.length} сұрақ</div>
              <div style={{display:"flex",gap:6}}><button onClick={()=>setShowRef(true)} style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:8,padding:"3px 8px",fontSize:11,color:"#4338CA",cursor:"pointer",fontWeight:700}}>🧪 Кестелер</button><button onClick={()=>setReportModal({q,sid:test.sid,idx:curr})} style={{background:"none",border:"1px solid #FCA5A5",borderRadius:8,padding:"3px 8px",fontSize:11,color:"#EF4444",cursor:"pointer",fontWeight:600}}>🚩 Хабарлау</button></div>
            </div>
          </div>
          <TestTimer initialSeconds={test.time} onExpire={()=>finishTest()}/>
        </div>
        <div style={{background:"#EEF0FF",borderRadius:99,height:8,marginBottom:18}}>
          <div style={{background:"linear-gradient(90deg,#4F46E5,#7C3AED)",height:8,borderRadius:99,width:`${(curr/qs.length)*100}%`,transition:"width 0.4s"}}/>
        </div>
        <div style={{...C.card,marginBottom:12,padding:20}}>
          {q.ctx&&<div style={{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:12,padding:"12px 14px",marginBottom:12,fontSize:14,lineHeight:1.7,color:"#0C4A6E"}}><div style={{fontWeight:800,fontSize:12,marginBottom:4,color:"#0284C7"}}>📖 Мәтінді оқып, сұраққа жауап беріңіз</div><Rich text={q.ctx}/></div>}
          <div style={{fontSize:17,fontWeight:700,lineHeight:1.65,color:"#1E1B4B"}}><Rich text={q.q}/></div>
          {q.topic&&<div style={{marginTop:6,...C.tag,...C.sec,fontSize:10}}>{q.topic}</div>}
        </div>
        {/* ── ANSWER OPTIONS (standard or matching) ── */}
        {q.type==="match"&&q.rights?(
          // Сәйкестендіру: әр жолға дұрыс әріпті таңдау (жауаптар қайталануы мүмкін)
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:10,fontWeight:600}}>{q.labels==="num"?"Әр жолға дұрыс жауап нөмірін таңдаңыз:":"Әр жолға дұрыс жауап әрпін таңдаңыз:"}</div>
            <div style={{background:"#F9FAFE",border:"1px solid #E5E7EB",borderRadius:12,padding:"10px 14px",marginBottom:12}}>
              {q.rights.map((r,ri)=>(
                <div key={ri} style={{fontSize:13.5,lineHeight:1.55,color:"#1E1B4B",marginBottom:ri<q.rights.length-1?4:0}}>
                  <b style={{color:"#4F46E5",marginRight:6}}>{(q.labels==="num"?ri+1:String.fromCharCode(65+ri))}</b><Rich text={r}/>
                </div>
              ))}
            </div>
            {(q.pairs||[]).map((p,pi)=>{
              const cur=(ans[curr]||{})[pi];
              const selR=cur===undefined||cur===null?-1:(q.srv?cur:q.rights.indexOf(q.pairs[cur]?.right));
              return(
                <div key={pi} style={{padding:"10px 12px",borderRadius:12,background:"#EEF0FF",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#1E1B4B",marginBottom:8}}>{q.labels==="num"?String.fromCharCode(65+pi)+")":(pi+1)+"."} <Rich text={p.left}/></div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {q.rights.map((r,ri)=>(
                      <button key={ri} aria-label={"Жауап "+(q.labels==="num"?ri+1:String.fromCharCode(65+ri))}
                        onClick={()=>setTest(pt=>({...pt,ans:{...pt.ans,[curr]:{...(pt.ans[curr]||{}),[pi]:q.srv?ri:q.pairs.findIndex(x=>x.right===r)}}}))}
                        style={{minWidth:44,height:40,borderRadius:10,border:selR===ri?"2px solid #4F46E5":"1.5px solid #D1D5DB",background:selR===ri?"#4F46E5":"#fff",color:selR===ri?"#fff":"#1E1B4B",fontWeight:800,fontSize:14,cursor:"pointer",padding:"0 10px"}}>
                        {(q.labels==="num"?ri+1:String.fromCharCode(65+ri))}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ):q.type==="match"?(
          // Сәйкестендіру (Matching) — ҰБТ форматы
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:10,fontWeight:600}}>Сол жақтан оң жаққа сәйкестендіріңіз:</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                {(q.pairs||[]).map((p,pi)=>(
                  <div key={pi} style={{padding:"10px 14px",borderRadius:12,background:"#EEF0FF",marginBottom:8,fontWeight:600,fontSize:14,color:"#1E1B4B",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:26,height:26,background:"#4F46E5",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:12,flexShrink:0}}>{String.fromCharCode(65+pi)}</span>
                    {p.left}
                  </div>
                ))}
              </div>
              <div>
                {(()=>{
                  const curAns=ans[curr]||{};
                  const pairs=q.pairs||[];
                  const order=seededShuffle(pairs.map((_,i)=>i),String(q.id||curr));
                  return order.map((oi,sp)=>{
                    const r=pairs[oi].right;
                    // find which left is matched to this right (oi = real pair index)
                    const matchedLeft=Object.keys(curAns).find(k=>curAns[k]===oi);
                    const isMatched=matchedLeft!==undefined;
                    return(
                      <div key={sp} onClick={()=>{
                        // cycle through matching: click right to assign to current unmatched left
                        const nextLeft=pairs.findIndex((_,pi)=>curAns[pi]===undefined||curAns[pi]===oi);
                        if(nextLeft>=0){
                          setTest(p=>({...p,ans:{...p.ans,[curr]:{...(p.ans[curr]||{}),[nextLeft]:oi}}}));
                        }
                      }}
                      style={{padding:"10px 14px",borderRadius:12,background:isMatched?"linear-gradient(135deg,#DCFCE7,#BBF7D0)":"#F9FAFE",marginBottom:8,fontWeight:600,fontSize:14,color:"#1E1B4B",display:"flex",alignItems:"center",gap:8,cursor:"pointer",border:`2px solid ${isMatched?"#22C55E":"#EEF0FF"}`,transition:"all 0.2s"}}>
                        {isMatched&&<span style={{width:24,height:24,background:"#22C55E",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:11,flexShrink:0}}>{String.fromCharCode(65+parseInt(matchedLeft))}</span>}
                        {r}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <button onClick={()=>setTest(p=>({...p,ans:{...p.ans,[curr]:{}}}))} style={{...C.btn,...C.sec,fontSize:12,padding:"6px 14px",marginTop:4}}>🔄 Тазалау</button>
          </div>
        ):(
          // Стандартты (A/B/C/D) немесе бірнеше дұрыс жауап
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
            {q.opts.map((opt,i)=>{
              const sel=q.multi?(ans[curr]||[]).includes(i):ans[curr]===i;
              return <button key={i} onClick={()=>{
                if(q.multi){
                  const prev=ans[curr]||[];
                  const next=prev.includes(i)?prev.filter(x=>x!==i):[...prev,i];
                  setTest(p=>({...p,ans:{...p.ans,[curr]:next}}));
                } else {
                  setTest(p=>({...p,ans:{...p.ans,[curr]:i}}));
                }
              }}
                style={{padding:"14px 20px",borderRadius:14,border:`2px solid ${sel?'#4F46E5':'#EEF0FF'}`,background:sel?"#EEF2FF":"#FAFAFE",color:"#1E1B4B",cursor:"pointer",textAlign:"left",fontSize:15,fontWeight:sel?800:400,display:"flex",alignItems:"center",gap:12,fontFamily:"inherit",transition:"all 0.15s"}}>
                <span style={{width:34,height:34,borderRadius:10,background:sel?"linear-gradient(135deg,#4F46E5,#7C3AED)":"#EEF0FF",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:13,flexShrink:0,color:sel?"#fff":"#6B7280",transition:"all 0.2s"}}>
                  {q.multi?"✓":["A","B","C","D"][i]}
                </span><span style={{minWidth:0,overflowWrap:"anywhere"}}><Rich text={opt}/></span>
              </button>;
            })}
            {q.multi&&<div style={{fontSize:12,color:"#6B7280",textAlign:"center"}}>⚡ Бірнеше дұрыс жауапты таңдауға болады</div>}
          </div>
        )}
        <div style={{display:"flex",gap:10,marginBottom:18}}>
          {curr>0&&<button style={{...C.btn,...C.sec,flex:1}} onClick={()=>setTest(p=>({...p,curr:p.curr-1}))}>← Алдыңғы</button>}
          {curr<qs.length-1
            ?<button style={{...C.btn,...C.pri,flex:1}} onClick={()=>setTest(p=>({...p,curr:p.curr+1}))}>Келесі →</button>
            :<button style={{...C.btn,background:"linear-gradient(135deg,#22C55E,#16A34A)",color:"#fff",flex:1,boxShadow:"0 4px 14px rgba(34,197,94,0.3)"}} onClick={()=>setConfirmFinish(true)}>✅ Тестті аяқтау</button>}
        </div>
        {showRef&&<RefTables onClose={()=>setShowRef(false)}/>}
        {confirmFinish&&(()=>{
          const isAns=(a)=>a!==undefined&&a!==null&&(Array.isArray(a)?a.length>0:typeof a==="object"?Object.keys(a).length>0:true);
          const un=qs.map((_,i)=>i).filter(i=>!isAns(test.ans[i]));
          return(
            <div onClick={()=>setConfirmFinish(false)} style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(15,23,42,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
              <div onClick={ev=>ev.stopPropagation()} style={{background:"#fff",borderRadius:18,padding:24,width:"min(420px,100%)",color:"#1E1B4B",boxShadow:"0 20px 60px rgba(0,0,0,0.35)"}}>
                <div style={{fontWeight:900,fontSize:18,marginBottom:10}}>Тестті аяқтауды растаңыз</div>
                <div style={{fontSize:15,lineHeight:1.8,marginBottom:12}}>
                  Жауап берілді: <b style={{color:"#16A34A"}}>{qs.length-un.length}</b> / {qs.length}<br/>
                  Жауап берілмеді: <b style={{color:un.length?"#DC2626":"#16A34A"}}>{un.length}</b>
                </div>
                {un.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
                    {un.slice(0,30).map(i=>(
                      <button key={i} onClick={()=>{setTest(p=>({...p,curr:i}));setConfirmFinish(false);}} style={{border:"1px solid #FCA5A5",background:"#FEF2F2",color:"#B91C1C",borderRadius:8,padding:"4px 9px",fontWeight:800,fontSize:12,cursor:"pointer"}}>{i+1}</button>
                    ))}
                    {un.length>30&&<span style={{fontSize:12,color:"#9CA3AF"}}>+{un.length-30}</span>}
                  </div>
                )}
                <div style={{display:"flex",gap:10}}>
                  <button style={{...C.btn,...C.sec,flex:1}} onClick={()=>setConfirmFinish(false)}>Жалғастыру</button>
                  <button style={{...C.btn,flex:1,background:"linear-gradient(135deg,#22C55E,#16A34A)",color:"#fff"}} onClick={()=>{setConfirmFinish(false);finishTest();}}>✅ Аяқтау</button>
                </div>
              </div>
            </div>
          );
        })()}
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {qs.map((_,i)=>(
            <button key={i} onClick={()=>setTest(p=>({...p,curr:i}))}
              style={{width:36,height:36,borderRadius:9,border:"none",cursor:"pointer",fontWeight:800,fontSize:12,transition:"all 0.15s",background:i===curr?"linear-gradient(135deg,#4F46E5,#7C3AED)":ans[i]!==undefined?"#DCFCE7":"#EEF0FF",color:i===curr?"#fff":ans[i]!==undefined?"#22C55E":"#6B7280"}}>
              {i+1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: RESULT
  ════════════════════════════════════════════════════════ */
  const PageResult=()=>{
    if(!test?.result)return null;
    const{result}=test;
    const g=result.score>=80?{l:"Өте жақсы! 🏆",c:"#22C55E",bg:"#F0FFF4",bc:"#86EFAC"}:result.score>=60?{l:"Жақсы 👍",c:"#F59E0B",bg:"#FFFBEB",bc:"#FCD34D"}:{l:"Жаттығу керек 💪",c:"#EF4444",bg:"#FFF5F5",bc:"#FCA5A5"};
    const dq=result.detailedQs||[];
    const idx=buildQIndex();
    const mb=user?.mistakes||{};
    const wt={};
    dq.forEach(q=>{if(q.pts<q.w){const t=idx[q.id]?.topic||"Басқа тақырып";wt[t]=(wt[t]||0)+1;}});
    const weak=Object.entries(wt).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const practiceFor=topic=>{
      const done=new Set(dq.map(q=>q.id));
      const all=Object.values(idx).filter(o=>o.topic===topic);
      const fresh=all.filter(o=>!done.has(o.q.id));
      const pick=[...(fresh.length>=3?fresh:all)].sort(()=>Math.random()-0.5).slice(0,3).map(o=>({...o.q}));
      startQuestionsTest(pick,result.sid,"practice",8);
    };
    const retry=()=>{
      if(result.lessonId&&(result.mode==="fix"||result.mode==="hw"))startLessonTest(result.sid,result.lessonId,result.mode);
      else if(result.mode==="errors"||result.mode==="practice")startMistakeTest(false);
      else startTest(test.sid);
    };
    const ERR_TYPES=["Формула білмеу","Есептеуден қателесу","Мәнмәтінді дұрыс оқымау"];
    const optList=(q,arr)=>(Array.isArray(arr)?arr:[]).map(i=>q.opts?.[i]).filter(Boolean).join("; ")||"Жауап берілмеді";
    return(
      <div style={{maxWidth:820,margin:"0 auto"}}>
        <div style={{...C.card,textAlign:"center",marginBottom:20,padding:"32px 24px",background:g.bg,border:`2px solid ${g.bc}`}}>
          <div style={{fontSize:56,marginBottom:6}}>{result.score>=80?"🏆":result.score>=60?"🎉":"💪"}</div>
          <h2 style={{fontSize:24,fontWeight:900,color:g.c,marginBottom:6}}>{g.l}</h2>
          <div style={{fontSize:56,fontWeight:900,color:g.c,lineHeight:1}}>{result.points!==undefined?result.points:result.correct}<span style={{fontSize:26,opacity:.7}}> / {result.maxPoints!==undefined?result.maxPoints:result.total} балл</span></div>
          <div style={{fontWeight:800,fontSize:18,color:g.c,marginTop:4}}>{result.score}%</div>
          <div style={{color:"#6B7280",fontSize:13,marginTop:6}}>{result.correct}/{result.total} сұрақ толық дұрыс • {result.subjectName} • {result.date}</div>
          <div style={{background:"rgba(0,0,0,0.06)",borderRadius:99,height:12,margin:"18px 0"}}>
            <div style={{background:`linear-gradient(90deg,${g.c},${g.c}bb)`,height:12,borderRadius:99,width:`${result.score}%`,transition:"width 1.2s"}}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <button style={{...C.btn,...C.pri}} onClick={retry}>🔄 Қайта тапсыру</button>
            {result.wrong?.length>0&&<button style={{...C.btn,...C.warn,fontWeight:700}} onClick={()=>startQuestionsTest(test.qs.filter(q=>result.wrong.includes(q.id)).map(q=>({...q})),test.sid,"errors")}>🔄 Қатемен жұмыс ({result.wrong.length})</button>}
            {result.score>=70&&<button style={{...C.btn,background:"linear-gradient(135deg,#F59E0B,#D97706)",color:"#fff",fontWeight:700}} onClick={()=>setCertModal(result)}>🏅 Сертификат</button>}
            <button style={{...C.btn,...C.sec}} onClick={()=>setPage("home")}>🏠 Басты бет</button>
            <button style={{...C.btn,background:"#25D366",color:"#fff",fontWeight:700}} onClick={()=>{
              const txt=`🎓 SmartUBT нәтижем: ${result.points!==undefined?result.points+"/"+result.maxPoints+" балл":result.score+"%"} — ${result.subjectName}! 💪`;
              window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");
            }}>📤 Бөлісу</button>
          </div>
        </div>
        {result.sections&&result.sections.length>0&&(
          <div style={{...C.card,padding:22,marginBottom:20}}>
            <div style={{fontWeight:900,fontSize:17,marginBottom:14}}>📊 Талдау картасы</div>
            {result.sections.map((sc,i)=>{
              const pct=sc.max?Math.round(sc.pts/sc.max*100):0;
              return(
                <div key={i} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:13.5,fontWeight:700,marginBottom:5}}>
                    <span style={{color:sc.color||"#4F46E5"}}>{sc.label}</span>
                    <span style={{flexShrink:0}}>{sc.pts}/{sc.max} балл</span>
                  </div>
                  <div style={{background:"rgba(0,0,0,0.07)",borderRadius:99,height:9}}>
                    <div style={{background:sc.color||"#4F46E5",height:9,borderRadius:99,width:`${pct}%`,transition:"width 1s"}}/>
                  </div>
                  <div style={{fontSize:11.5,color:"#9CA3AF",marginTop:3}}>Толық дұрыс: {sc.full}/{sc.count} тапсырма • {pct}%</div>
                </div>
              );
            })}
          </div>
        )}
        {weak.length>0&&(
          <div style={{...C.card,padding:20,marginBottom:20,border:"2px solid #FCA5A5",background:"#FFF5F5"}}>
            <div style={{fontWeight:900,fontSize:16,color:"#B91C1C",marginBottom:4}}>🎯 Әлсіз тақырыптарыңыз</div>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:12}}>Қателер «Қателер банкіңізге» сақталды: 2 күннен, содан 1 аптадан кейін қайта ұсынылады.</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {weak.map(([t,n])=>(
                <div key={t} style={{display:"flex",alignItems:"center",gap:10,background:"#fff",borderRadius:12,padding:"10px 14px",flexWrap:"wrap"}}>
                  <span style={{flex:1,minWidth:160,fontWeight:700,fontSize:14,color:"#1E1B4B"}}>{t}</span>
                  <span style={{fontSize:12,fontWeight:800,color:"#EF4444"}}>{n} қате</span>
                  <button style={{...C.btn,...C.sec,padding:"6px 12px",fontSize:12,fontWeight:700}} onClick={()=>practiceFor(t)}>➕ 3 ұқсас сұрақ</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {result.score<70&&(()=>{
          const ew=content.errorWork?.[result.sid];
          if(!ew||(!ew.videoUrl&&!ew.pdfUrl))return null;
          return(
            <div style={{...C.card,padding:20,marginBottom:20,border:"2px solid #FCD34D",background:"#FFFBEB"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontSize:28}}>🔄</span>
                <div>
                  <div style={{fontWeight:900,fontSize:16,color:"#92400E"}}>Қатемен жұмыс материалы</div>
                  <div style={{fontSize:13,color:"#B45309"}}>{ew.desc||"Тақырыпты тереңірек үйрен"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {ew.videoUrl&&(<a href={ew.videoUrl} target="_blank" rel="noopener" style={{...C.btn,background:"#EF4444",color:"#fff",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:12,fontWeight:700}}>▶ Видео талдау</a>)}
                {ew.pdfUrl&&(<a href={ew.pdfUrl} target="_blank" rel="noopener" style={{...C.btn,background:"#6366F1",color:"#fff",textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:12,fontWeight:700}}>📄 PDF талдау</a>)}
              </div>
            </div>
          );
        })()}
        <h3 style={{fontWeight:900,marginBottom:14,fontSize:17}}>📋 Толық талдау</h3>
        {dq.map((q,i)=>{
          const full=q.pts===q.w,part=q.pts>0&&!full;
          const col=full?"#22C55E":part?"#F59E0B":"#EF4444";
          const topic=idx[q.id]?.topic;
          return <div key={i} style={{...C.card,marginBottom:10,borderLeft:`4px solid ${col}`,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,gap:8}}>
              <span style={{fontWeight:700,flex:1,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{i+1}. <Rich text={q.q}/></span>
              <span style={{flexShrink:0,fontSize:12,fontWeight:900,color:col,background:full?"#F0FFF4":part?"#FFFBEB":"#FFF5F5",borderRadius:8,padding:"4px 8px",height:"fit-content"}}>{q.pts}/{q.w} балл</span>
            </div>
            {topic&&<div style={{fontSize:11,color:"#9CA3AF",marginBottom:6}}>🏷 {topic}</div>}
            {q.type==="match"?(
              <div style={{fontSize:13,display:"flex",flexDirection:"column",gap:4,marginBottom:4}}>
                {(q.pairs||[]).map((pr,pi)=>{
                  const chosen=q.userAns&&q.userAns[pi]!==undefined?q.pairs[q.userAns[pi]]?.right:null;
                  const pok=chosen===pr.right;
                  return <div key={pi} style={{color:pok?"#16A34A":"#DC2626"}}>{pok?"✅":"❌"} <Rich text={pr.left}/> → <strong>{chosen?<Rich text={chosen}/>:"таңдалмады"}</strong>{!pok&&<span style={{color:"#6B7280"}}> (дұрысы: <Rich text={pr.right}/>)</span>}</div>;
                })}
              </div>
            ):q.multi?(
              <>
                <div style={{fontSize:13,color:"#6B7280",marginBottom:4}}>Жауабыңыз: <strong style={{color:col}}><Rich text={optList(q,q.userAns)}/></strong></div>
                {!full&&<div style={{fontSize:13,color:"#6B7280",marginBottom:4}}>✅ Дұрыс жауаптар: <strong style={{color:"#22C55E"}}><Rich text={optList(q,q.ans_all)}/></strong></div>}
              </>
            ):(
              <>
                <div style={{fontSize:13,color:"#6B7280",marginBottom:4}}>Жауабыңыз: <strong style={{color:col}}><Rich text={q.opts?.[q.userAns]??"Жауап берілмеді"}/></strong></div>
                {!full&&<div style={{fontSize:13,color:"#6B7280",marginBottom:4}}>✅ Дұрыс жауап: <strong style={{color:"#22C55E"}}><Rich text={q.opts?.[q.ans]??""}/></strong></div>}
              </>
            )}
            {q.exp&&<div style={{fontSize:13,background:darkMode?"rgba(79,70,229,0.15)":"#EEF2FF",borderRadius:10,padding:"10px 14px",color:darkMode?"#A5B4FC":"#4338CA",marginTop:4}}>💡 <Rich text={q.exp}/></div>}
            {!full&&(
              <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:11,color:"#9CA3AF"}}>Қате түрі:</span>
                {ERR_TYPES.map(t=>{const on=mb[q.id]?.type===t;return <button key={t} onClick={()=>setErrType(q.id,t)} style={{border:`1px solid ${on?"#4F46E5":"#E5E7EB"}`,background:on?"#EEF2FF":"#fff",color:on?"#4F46E5":"#6B7280",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:on?800:500,cursor:"pointer",fontFamily:"inherit"}}>{t}</button>;})}
                <button onClick={()=>setReportModal({q,sid:test?.result?.sid,idx:i})} style={{background:"none",border:"none",cursor:"pointer",color:"#EF4444",fontSize:11,marginLeft:"auto",padding:0,fontFamily:"inherit"}}>🚩 Қате сұрақты хабарлау</button>
              </div>
            )}
          </div>;
        })}
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: STUDY PLAN
  ════════════════════════════════════════════════════════ */
  const PageStudyPlan=()=>{
    const plan=user?.studyPlan;
    if(!plan||!plan.weeks){
      return(
        <div style={{maxWidth:"min(700px,100%)",margin:"0 auto"}}>
          <h2 style={{fontWeight:900,fontSize:22,marginBottom:20}}>📅 Апталық жоспар</h2>
          <div style={{...C.card,padding:40,textAlign:"center"}}>
            <div style={{fontSize:56}}>📅</div>
            <div style={{fontWeight:800,fontSize:18,marginBottom:8}}>Жоспар жоқ</div>
            <div style={{color:"#9CA3AF",marginBottom:20}}>Жоспар жасау үшін пәндерді таңдаңыз</div>
            <button style={{...C.btn,...C.pri,padding:"12px 24px"}} onClick={()=>{
              const plan=generateStudyPlan(user?.subjects||[],null);
              updateUser({studyPlan:plan});
              showToast("Жоспар жасалды! 📅");
            }}>📅 Жоспар жасау</button>
          </div>
        </div>
      );
    }
    const wp=checkWeeklyProgress(plan);
    const totalDone=plan.weeks.filter(w=>w.completed).length;
    return(
      <div style={{maxWidth:"min(860px,100%)",margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:22,color:"#1E1B4B"}}>📅 Апталық оқу жоспары</h2>
            <div style={{color:"#9CA3AF",fontSize:13}}>{plan.totalWeeks} апта • {plan.totalLessons} сабақ • {plan.createdAt}дан бастап</div>
          </div>
          <button style={{...C.btn,...C.sec}} onClick={()=>{
            const np=generateStudyPlan(user?.subjects||[],null);
            updateUser({studyPlan:np});showToast("Жоспар жаңартылды!");
          }}>🔄 Жаңарту</button>
        </div>
        {/* Overall progress */}
        <div style={{...C.card,padding:20,marginBottom:20,background:"linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,color:"#fff"}}>
            {[{l:"Барлық апта",v:plan.totalWeeks},{l:"Аяқталды",v:totalDone},{l:"Ағымдағы",v:plan.currentWeek},{l:"Прогресс",v:Math.round(totalDone/plan.totalWeeks*100)+"%"}].map((s,i)=>(
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:900}}>{s.v}</div>
                <div style={{fontSize:11,opacity:0.7}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Weekly plan warning */}
        {wp&&wp.pct<100&&(
          <div style={{background:"#FFFBEB",borderRadius:16,padding:"16px 20px",marginBottom:20,border:"2px solid #FCD34D",display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:32}}>⚠️</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:900,color:"#92400E",marginBottom:2}}>{wp.cw}-апта жоспары аяқталмаған!</div>
              <div style={{fontSize:14,color:"#B45309"}}>{wp.doneLessons}/{wp.total} сабақ аяқталды ({wp.pct}%)</div>
              <div style={{fontSize:12,color:"#D97706",marginTop:4}}>⚠️ Барлық сабақты орындамасаңыз келесі аптаға өтілмейді</div>
            </div>
            <button style={{...C.btn,background:"#F59E0B",color:"#fff",padding:"8px 14px",fontSize:13,fontWeight:700}} onClick={()=>{
              if(wp.pct<80){showToast("Алдымен осы аптаны аяқтаңыз!","err");}
              else{
                const np={...plan,currentWeek:Math.min(plan.currentWeek+1,plan.totalWeeks),weeks:plan.weeks.map((w,i)=>i===wp.cw-1?{...w,completed:true}:w)};
                updateUser({studyPlan:np});showToast("Келесі аптаға өттіңіз! 🎉");
              }
            }}>Келесі апта →</button>
          </div>
        )}
        {/* Weeks list */}
        {plan.weeks.map((w,wi)=>{
          const isCurrent=wi+1===plan.currentWeek;
          const isPast=wi+1<plan.currentWeek;
          const isFuture=wi+1>plan.currentWeek;
          const doneLessonsInWeek=w.lessons.filter(l=>user?.progress?.[l.lessonId]).length;
          const weekPct=Math.round(doneLessonsInWeek/Math.max(1,w.lessons.length)*100);
          return(
            <div key={wi} style={{...C.card,marginBottom:14,overflow:"hidden",opacity:isFuture?0.6:1,border:`2px solid ${isCurrent?'#4F46E5':isPast?'#22C55E':'#EEF0FF'}`}}>
              <div style={{padding:"14px 20px",background:isCurrent?"linear-gradient(135deg,#4F46E5,#7C3AED)":isPast?"#F0FFF4":"#FAFAFE",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:900,fontSize:15,color:isCurrent?'#fff':isPast?'#22C55E':'#1E1B4B'}}>
                    {isCurrent?'► ':isPast?'✓ ':isFuture?'⊠ ':''}{w.week}-апта
                    {isCurrent&&<span style={{marginLeft:8,fontSize:11,background:"rgba(255,255,255,0.2)",borderRadius:99,padding:"2px 10px"}}>Ағымдағы</span>}
                  </div>
                  <div style={{fontSize:12,color:isCurrent?"rgba(255,255,255,0.7)":isPast?"#22C55E99":"#9CA3AF"}}>{w.dateStart} — {w.dateEnd}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:900,fontSize:18,color:isCurrent?"#fff":isPast?"#22C55E":"#6B7280"}}>{weekPct}%</div>
                  <div style={{fontSize:11,color:isCurrent?"rgba(255,255,255,0.6)":"#9CA3AF"}}>{doneLessonsInWeek}/{w.lessons.length}</div>
                </div>
              </div>
              {(isCurrent||isPast)&&(
                <div>
                  <div style={{background:"#EEF0FF",height:6}}>
                    <div style={{background:isPast?"#22C55E":"linear-gradient(90deg,#4F46E5,#7C3AED)",height:6,width:weekPct+"%",transition:"width 0.8s"}}/>
                  </div>
                  <div style={{padding:"12px 16px",display:"flex",flexDirection:"column",gap:8}}>
                    {w.lessons.map((l,li)=>{
                      const done=user?.progress?.[l.lessonId];
                      const sub=SUBJECTS.find(s=>s.id===l.sid);
                      return(
                        <div key={li} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:10,background:done?"#F0FFF4":"#FAFAFE",border:`1px solid ${done?'#86EFAC':'#EEF0FF'}`,cursor:"pointer"}}
                          onClick={()=>{
                            if(isFuture){showToast("Алдымен алдыңғы аптаны аяқтаңыз","err");return;}
                            setSubjectId(l.sid);setTopicId(null);
                            const allTops=content.topics[l.sid]||[];
                            const tp=allTops.find(t=>t.lessons.some(ls=>ls.id===l.lessonId));
                            if(tp){setTopicId(tp.id);setLessonId(l.lessonId);setLessonTab(l.lessonId.endsWith("_review")?"bekitu":"video");setGameMode(null);setPage("lesson");}
                            else{setPage("lessons");}
                          }}>
                          <span style={{fontSize:16}}>{done?"✅":sub?.icon||"📚"}</span>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:done?"#22C55E":"#1E1B4B"}}>{l.lessonTitle}</div>
                            <div style={{fontSize:11,color:"#9CA3AF"}}>{sub?.name} • {l.topicTitle}</div>
                          </div>
                          {!done&&<span style={{fontSize:11,color:"#4F46E5",fontWeight:600}}>Бастау →</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: STATS
  ════════════════════════════════════════════════════════ */
  const PageStats=()=>{
    const {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,LineChart,Line,ResponsiveContainer,RadarChart,Radar,PolarGrid,PolarAngleAxis}=window.Recharts||{};
    // Weekly data (last 7 days)
    const weeklyData=Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-6+i);
      const ds=d.toLocaleDateString("kk-KZ",{month:"short",day:"numeric"});
      const dayRes=myResults.filter(r=>{
        const rd=new Date(r.rawDate||r.date);
        return rd.getDate()===d.getDate()&&rd.getMonth()===d.getMonth();
      });
      return {name:ds,тест:dayRes.length,балл:dayRes.length?Math.round(dayRes.reduce((a,r)=>a+r.score,0)/dayRes.length):0};
    });
    // Subject radar data
    const radarData=SUBJECTS.filter(s=>(user?.subjects||[]).includes(s.id)).map(s=>{
      const sr=myResults.filter(r=>r.sid===s.id);
      return {пән:s.name.slice(0,8),балл:sr.length?Math.round(sr.reduce((a,b)=>a+b.score,0)/sr.length):0};
    });
    const dm=!!window.__ubt_dark;
    const axColor=dm?"#9BA3BF":"#9CA3AF";
    const gridColor=dm?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.05)";
    return(
    <div>
      <h2 style={{fontWeight:900,fontSize:22,marginBottom:4}}>📊 Менің статистикам</h2>
      <p style={{color:"#9CA3AF",marginBottom:20}}>Жетістіктеріңізді бақылаңыз</p>
      {myResults.length===0?(
        <div style={{...C.card,textAlign:"center",padding:48}}><div style={{fontSize:52}}>📭</div><p style={{color:"#9CA3AF",margin:"12px 0"}}>Нәтиже жоқ</p><button style={{...C.btn,...C.pri}} onClick={()=>setPage("subjects")}>Тест тапсыру</button></div>
      ):(
        <>
          {/* Stats cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(150px,44%),1fr))",gap:12,marginBottom:24}}>
            {[{l:"Тесттер",v:myResults.length,i:"📝",c:"#4F46E5"},{l:"Орташа",v:avgScore+"%",i:"🎯",c:"#EC4899"},{l:"Максимум",v:Math.max(...myResults.map(r=>r.score))+"%",i:"🏆",c:"#F59E0B"},{l:"XP жинады",v:user?.xp||0,i:"⭐",c:"#22C55E"}]
              .map((s,i)=><div key={i} style={{...C.card,textAlign:"center",padding:16}}><div style={{fontSize:26}}>{s.i}</div><div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{s.l}</div></div>)}
          </div>
          {/* Weekly chart */}
          {BarChart&&(<div style={{...C.card,padding:20,marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:16}}>📈 Апталық белсенділік</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} margin={{top:5,right:10,left:-20,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:axColor}}/>
                <YAxis tick={{fontSize:11,fill:axColor}}/>
                <Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",fontSize:13}}/>
                <Bar dataKey="балл" fill="#4F46E5" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>)}
          {/* Score trend line chart */}
          {LineChart&&myResults.length>2&&(<div style={{...C.card,padding:20,marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8,color:C.text.color}}>📉 Балл тренді</div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={myResults.slice(-15).map((r,i)=>({n:i+1,балл:r.score}))}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor}/>
                <XAxis dataKey="n" tick={{fontSize:10,fill:axColor}}/>
                <YAxis domain={[0,100]} tick={{fontSize:10,fill:axColor}}/>
                <Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",fontSize:12}}/>
                <Line type="monotone" dataKey="балл" stroke="#4F46E5" strokeWidth={2.5} dot={{r:3,fill:"#4F46E5"}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>)}
          {/* Radar chart */}
          {RadarChart&&radarData.length>2&&(<div style={{...C.card,padding:20,marginBottom:20}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🎯 Пәндер бойынша деңгей</div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke={gridColor}/>
                <PolarAngleAxis dataKey="пән" tick={{fontSize:10,fill:axColor}}/>
                <Radar dataKey="балл" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.25} strokeWidth={2}/>
                <Tooltip contentStyle={{borderRadius:12,border:"none",boxShadow:"0 4px 20px rgba(0,0,0,0.12)",fontSize:13}}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>)}
          {/* Subject bars */}
          <h3 style={{fontWeight:800,marginBottom:12,color:darkMode?"#E2E8FF":"#1E1B4B"}}>📚 Пән бойынша нәтижелер</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
            {SUBJECTS.filter(s=>(user?.subjects||[]).includes(s.id)).map(s=>{
              const sr=myResults.filter(r=>r.sid===s.id);
              const av=sr.length?Math.round(sr.reduce((a,b)=>a+b.score,0)/sr.length):0;
              return <div key={s.id} style={{...C.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22,flexShrink:0}}>{s.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{s.name}</div>
                  <div style={{background:"#EEF0FF",borderRadius:99,height:8,position:"relative"}}>
                    <div style={{background:`linear-gradient(90deg,${s.color},${s.color}bb)`,height:8,borderRadius:99,width:`${av}%`,transition:"width 1s"}}/>
                  </div>
                </div>
                <div style={{fontWeight:900,color:s.color,flexShrink:0,minWidth:40,textAlign:"right"}}>{av}%</div>
                <div style={{fontSize:11,color:"#9CA3AF",flexShrink:0}}>{sr.length} тест</div>
              </div>;
            })}
          </div>
          {/* Recent results */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{fontWeight:800}}>Соңғы нәтижелер</h3>
            <button style={{...C.btn,...C.sec,fontSize:11,padding:"5px 12px"}} onClick={()=>{
              // CSV export
              const rows=[["Пән","Балл","Дұрыс","Жалпы","Күні"],...myResults.map(r=>[r.subjectName,r.score+"%",r.correct,r.total,r.date])];
              const csv=rows.map(r=>r.join(",")).join("\n");
              const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent("\uFEFF"+csv);
              a.download=`smart_ubt_${user?.name||"results"}_${new Date().toLocaleDateString("kk-KZ").replace(/\//g,"-")}.csv`;a.click();
            }}>📥 CSV</button>
          </div>
          {myResults.slice(0,20).map((r,i)=>(
            <div key={i} style={{...C.card,marginBottom:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
              <div style={{fontSize:22}}>{SUBJECTS.find(s=>s.id===r.sid)?.icon}</div>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.subjectName}</div><div style={{fontSize:11,color:"#9CA3AF"}}>{r.date}</div></div>
              <div style={{fontWeight:900,color:r.score>=80?"#22C55E":r.score>=60?"#F59E0B":"#EF4444"}}>{r.score}%</div>
              <div style={{...C.tag,...C.sec,fontSize:11}}>{r.correct}/{r.total}</div>
              {r.wrong?.length>0&&<button style={{...C.btn,...C.sec,fontSize:11,padding:"5px 10px"}} onClick={()=>startTest(r.sid,r.wrong)}>🔄</button>}
            </div>
          ))}
        </>
      )}
    </div>
    );
  };


  /* ════════════════════════════════════════════════════════
     PAGE: AI
  ════════════════════════════════════════════════════════ */
  const PageAI=()=>(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <h2 style={{fontWeight:900,fontSize:22,marginBottom:4,color:"#1E1B4B"}}>🤖 AI Мұғалім</h2>
      <p style={{color:"#9CA3AF",marginBottom:16}}>Кез-келген ҰБТ сұрағын қазақша сұраңыз</p>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {["Математика интегралын түсіндір","Фотосинтез дегеніміз не?","Ньютон заңдары","Алаш Орда тарихы","log₂(16) = ?"].map(q=>(
          <button key={q} onClick={()=>setAiInput(q)} style={{...C.btn,...C.sec,padding:"6px 12px",fontSize:12}}>{q}</button>
        ))}
      </div>
      <div ref={aiRef} style={{...C.card,height:420,overflowY:"auto",marginBottom:14,padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {aiMsgs.length===0&&<div style={{margin:"auto",textAlign:"center",color:"#9CA3AF"}}><div style={{fontSize:52,marginBottom:8}}>🤖</div><div style={{fontWeight:700,marginBottom:4}}>AI Мұғалімге қош келдіңіз!</div><div style={{fontSize:14}}>Кез-келген сұрақты қазақша сұраңыз</div></div>}
        {aiMsgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"82%",padding:"12px 16px",borderRadius:m.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px",background:m.role==="user"?"linear-gradient(135deg,#4F46E5,#7C3AED)":"#fff",color:m.role==="user"?"#fff":"#1E1B4B",fontSize:14,lineHeight:1.7,boxShadow:"0 2px 8px rgba(0,0,0,0.07)",border:m.role==="assistant"?"1px solid #EEF0FF":"none",whiteSpace:"pre-wrap"}}>
              {m.text}
            </div>
          </div>
        ))}
        {aiLoad&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{padding:"12px 16px",borderRadius:"4px 18px 18px 18px",background:"#fff",border:"1px solid #EEF0FF",color:"#9CA3AF",fontSize:14}}>⏳ Жазылуда...</div></div>}
      </div>
      <div style={{display:"flex",gap:10}}>
        <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&askAI()} placeholder="Сұрағыңызды жазыңыз..." style={C.input}/>
        <button onClick={askAI} disabled={aiLoad} style={{...C.btn,...C.pri,flexShrink:0,padding:"12px 18px",fontSize:18}}>➤</button>
      </div>
    </div>
  );

  /* ════════════════════════════════════════════════════════
     PAGE: PROFILE
  ════════════════════════════════════════════════════════ */
  const PageProfile=()=>{
    const form=profileForm; const setForm=setProfileForm;
    const plan=PLANS.find(p=>p.id===user?.plan)||PLANS[0];
    return(
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <h2 style={{fontWeight:900,fontSize:22,marginBottom:20,color:"#1E1B4B"}}>👤 Менің профилім</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:14,marginBottom:14}}>
          <div style={{...C.card,padding:20}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:56,marginBottom:8}}>{user?.avatar}</div>
              <div style={{fontWeight:900,fontSize:18}}>{user?.name}</div>
              <div style={{color:"#9CA3AF",fontSize:13}}>{user?.email}</div>
              <div style={{display:"flex",justifyContent:"center",gap:8,marginTop:10}}>
                <span style={{...C.tag,...C.sec}}>{user?.grade}-сынып</span>
                <span style={{...C.tag,background:plan.id==="premium"?"#FEF3C7":"#EEF2FF",color:plan.id==="premium"?"#F59E0B":"#4F46E5"}}>{plan.name} жоспар</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:8}}>
              {[{l:"XP",v:user?.xp||0,i:"⭐"},{l:"Тесттер",v:myResults.length,i:"📝"},{l:"Пәндер",v:(user?.subjects||[]).length,i:"📚"},{l:"Streak",v:user?.streak||0,i:"🔥"}].map((s,i)=>(
                <div key={i} style={{background:"#F5F7FF",borderRadius:12,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:18}}>{s.i}</div><div style={{fontWeight:800,fontSize:16,color:"#4F46E5"}}>{s.v}</div><div style={{fontSize:10,color:"#9CA3AF"}}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{...C.card,padding:20}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>✏️ Өзгерту</div>
            {[{k:"name",ph:"Аты-жөн"},{k:"phone",ph:"Телефон"},{k:"school",ph:"Мектеп"},{k:"city",ph:"Қала"}].map(f=>(
              <input key={f.k} value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{...C.input,marginBottom:10}}/>
            ))}
            <button style={{...C.btn,...C.pri,width:"100%"}} onClick={()=>{updateUser({...form});showToast("Профиль сақталды ✅")}}>💾 Сақтау</button>
          </div>
        </div>
        {/* Payment plan */}
        <div style={{...C.card,padding:20}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:16}}>💳 Жоспар & Төлем</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {PLANS.map(pl=>(
              <div key={pl.id} style={{borderRadius:16,padding:16,border:`2px solid ${user?.plan===pl.id?pl.color:'#EEF0FF'}`,background:user?.plan===pl.id?pl.color+"0D":"#FAFAFE",cursor:"pointer",position:"relative",transition:"all 0.2s"}}
                onClick={()=>{
                  if(pl.id!=="free"){setAdminModal({type:"payment",plan:pl});}
                  else{updateUser({plan:"free"});showToast("Тегін жоспарға ауыстырылды");}
                }}>
                {pl.popular&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",...C.tag,background:"#F59E0B",color:"#fff",fontSize:9,whiteSpace:"nowrap"}}>⭐ Танымал</div>}
                {user?.plan===pl.id&&<div style={{position:"absolute",top:8,right:8,fontSize:14}}>✅</div>}
                <div style={{fontWeight:900,fontSize:15,color:pl.color,marginBottom:4}}>{pl.name}</div>
                <div style={{fontWeight:800,fontSize:16,color:"#1E1B4B",marginBottom:8}}>{pl.price===0?"Тегін":pl.price.toLocaleString()+" ₸"}</div>
                <div style={{fontSize:11,color:"#6B7280",lineHeight:1.6}}>{pl.features.join(" • ")}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /* ════════════════════════════════════════════════════════
     PAGE: ҰБТ СИМУЛЯЦИЯСЫ
  ════════════════════════════════════════════════════════ */
  const PageUBT=()=>{
    const [step,setStep]=useState("select"); // select | confirm | test
    const [profSubs,setProfSubs]=useState(["chemistry"]); // жалғыз пән — автоматты таңдалған
    const [mandVariants,setMandVariants]=useState({}); // {sid: variantId}
    const [profVariants,setProfVariants]=useState({});

    // Бұл нұсқада тек бейінді пән (химия) тестіленеді — міндетті пәндер деректері жоқ
    const MANDATORY=[];
    const PROFILE_SUBJECTS=SUBJECTS;
    const mandQ=MANDATORY.reduce((a,m)=>a+m.q,0);
    const profQ=profSubs.length*40;
    const totalQ=mandQ+profQ;
    const totalPts=mandQ+profSubs.length*50;
    const totalMin=240; // 4 сағат (нақты ҰБТ)

    const toggleProf=(sid)=>{
      setProfSubs(p=>p.includes(sid)?p.filter(x=>x!==sid):p.length<2?[...p,sid]:p);
    };

    const startUBT=()=>{
      // Pick random variants for mandatory subjects
      const mVars={};
      MANDATORY.forEach(m=>{
        const vars=content.variants?.[m.id]||[];
        if(vars.length) mVars[m.id]=vars[Math.floor(Math.random()*vars.length)].id;
      });
      // Pick random variants for profile subjects
      const pVars={};
      profSubs.forEach(sid=>{
        const vars=content.variants?.[sid]||[];
        if(vars.length) pVars[sid]=vars[Math.floor(Math.random()*vars.length)].id;
      });

      // Build combined question array
      let allQs=[];
      let sections=[];
      [...MANDATORY.map(m=>({id:m.id,label:m.label,q:m.q,pts:m.pts,color:m.color})),
       ...profSubs.map(sid=>{const s=SUBJECTS.find(x=>x.id===sid);return {id:sid,label:s?.name,q:40,pts:50,color:s?.color||"#9CA3AF"}})
      ].forEach(sec=>{
        const varId={...mVars,...pVars}[sec.id];
        const variant=(content.variants?.[sec.id]||[]).find(v=>v.id===varId);
        const qs=(variant?.questions||[]).slice(0,sec.q);
        sections.push({...sec,variantTitle:variant?.title||"",start:allQs.length,count:qs.length});
        allQs=[...allQs,...qs.map(q=>({...q,_section:sec.id,_sectionLabel:sec.label,_sectionColor:sec.color}))];
      });

      if(!allQs.length)return showToast("Тест нұсқалары жоқ. Adminге хабарласыңыз.","err");

      setTest({
        sid:"ubt",qs:allQs,curr:0,ans:{},
        time:totalMin*60,done:false,mode:"ubt",
        sections,variantTitle:"ҰБТ Симуляциясы"
      });
      setPage("test");
    };

    return(
      <div style={{maxWidth:"min(800px,100%)",margin:"0 auto"}}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1E1B4B,#4F46E5)",borderRadius:20,padding:"28px 28px",marginBottom:24,color:"#fff"}}>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:12}}>
            <div style={{fontSize:48}}>🎓</div>
            <div>
              <h1 style={{fontSize:24,fontWeight:900,margin:0}}>ҰБТ Симуляциясы</h1>
              <p style={{opacity:0.8,margin:0,fontSize:14}}>Нақты ҰБТ форматында жаттығыңыз</p>
            </div>
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {[
              {i:"📋",l:`${totalQ} сұрақ`},
              {i:"🏆",l:`${totalPts} балл`},
              {i:"⏱",l:"240 минут"},
              {i:"📚",l:"Химия"},
            ].map((s,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"6px 14px",fontSize:13,fontWeight:700}}>
                {s.i} {s.l}
              </div>
            ))}
          </div>
        </div>

        {/* Profile subject (жалғыз — химия) */}
        <div style={{marginBottom:24}}>
          <div style={{fontWeight:800,fontSize:16,color:"#1E1B4B",marginBottom:12}}>🧪 Тест пәні</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(160px,45%),1fr))",gap:10}}>
            {PROFILE_SUBJECTS.map(s=>{
              const varCount=(content.variants?.[s.id]||[]).length;
              return(
                <div key={s.id} style={{
                  background:"linear-gradient(135deg,#4F46E5,#7C3AED)",
                  borderRadius:14,padding:"16px 14px",
                  border:"2px solid transparent",
                  textAlign:"center",
                }}>
                  <div style={{fontSize:28,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontWeight:800,fontSize:13,color:"#fff",marginBottom:4}}>{s.name}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.7)"}}>
                    {varCount?`${varCount} нұсқа`:"Нұсқа жоқ"} • 50 балл
                  </div>
                  <div style={{marginTop:6,fontSize:16}}>✓</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* UBT info */}
        <div style={{...C.card,padding:16,marginBottom:20,background:"#FFFBEB",border:"1px solid #FCD34D"}}>
          <div style={{fontWeight:800,fontSize:13,color:"#92400E",marginBottom:8}}>📖 ҰБТ форматы туралы</div>
          <div style={{fontSize:12,color:"#78350F",lineHeight:1.7}}>
            • <b>Химия:</b> 40 сұрақ × 50 балл = <b>50 балл</b><br/>
            • Симуляция нақты уақыт форматымен жүреді (~{totalMin} минут)
          </div>
        </div>

        {/* Start button */}
        <button onClick={startUBT}
          style={{...C.btn,...C.pri,width:"100%",padding:"16px",fontSize:17,fontWeight:900,
            background:"linear-gradient(135deg,#4F46E5,#7C3AED)",borderRadius:16,
            boxShadow:"0 8px 24px rgba(79,70,229,0.4)",
          }}>
          🎓 Химия тестін бастау • {totalPts} балл →
        </button>
      </div>
    );
  };


  /* ════════════════════════════════════════════════════════
     PAGE: LEADERBOARD
  ════════════════════════════════════════════════════════ */
  const PageLeaderboard=()=>{
    const [lbFilter,setLbFilter]=React.useState("all"); // "all"|"week"|"month"
    const allResultsRaw=gS("ubt3_results",[]);
    const now=new Date();
    const allResults=allResultsRaw.filter(r=>{
      if(lbFilter==="week"){const d=new Date(r.rawDate||r.date);return(now-d)<7*86400000;}
      if(lbFilter==="month"){const d=new Date(r.rawDate||r.date);return(now-d)<30*86400000;}
      return true;
    });
    // Build scores per user
    const userScores={};
    allResults.forEach(r=>{
      if(!userScores[r.userId])userScores[r.userId]={total:0,count:0,best:0,name:r.userName||"Оқушы",avatar:"🎓"};
      userScores[r.userId].total+=r.score;
      userScores[r.userId].count+=1;
      if(r.score>userScores[r.userId].best)userScores[r.userId].best=r.score;
    });
    // Also add from users list
    users.filter(u=>u.role==="student").forEach(u=>{
      if(!userScores[u.id]){
        const rs=results.filter(r=>r.userId===u.id||r.userId===String(u.id));
        if(rs.length>0){
          const avg=Math.round(rs.reduce((a,r)=>a+r.score,0)/rs.length);
          userScores[u.id]={total:avg*rs.length,count:rs.length,best:Math.max(...rs.map(r=>r.score)),name:u.name,avatar:u.avatar||"👤"};
        } else {
          userScores[u.id]={total:0,count:0,best:0,name:u.name,avatar:u.avatar||"👤"};
        }
      }
    });
    const ranked=Object.entries(userScores)
      .map(([id,s])=>({id,name:s.name,avatar:s.avatar,avg:s.count>0?Math.round(s.total/s.count):0,best:s.best,count:s.count}))
      .filter(u=>u.count>0)
      .sort((a,b)=>b.avg-a.avg);
    const medals=["🥇","🥈","🥉"];
    const myRank=ranked.findIndex(r=>r.id===String(user?.id)||r.id===user?.id)+1;
    const myEntry=ranked.find(r=>r.id===String(user?.id)||r.id===user?.id);
    return(
      <div style={{maxWidth:"min(760px,100%)",margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div>
            <h2 style={{fontWeight:900,fontSize:22,color:darkMode?"#E2E8FF":"#1E1B4B"}}>🏆 Рейтинг</h2>
            <div style={{fontSize:13,color:darkMode?"#9BA3BF":"#9CA3AF"}}>{ranked.length} оқушы • Орташа балл бойынша</div>
          </div>
        </div>
        {/* My rank card */}
        {myEntry&&(
          <div style={{...C.card,padding:16,marginBottom:16,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",border:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{fontSize:36,fontWeight:900,color:"#FCD34D",minWidth:50,textAlign:"center"}}>#{myRank}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:800,fontSize:16,color:"#fff"}}>{myEntry.name} (Сіз)</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>Орт. балл: {myEntry.avg}% • Тест: {myEntry.count} • Үздік: {myEntry.best}%</div>
              </div>
              <div style={{fontSize:40}}>{myEntry.avatar||"👤"}</div>
            </div>
          </div>
        )}
        {/* Top 3 */}
        {ranked.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
            {ranked.slice(0,3).map((u,i)=>(
              <div key={u.id} style={{...C.card,padding:"16px 10px",textAlign:"center",background:i===0?"linear-gradient(135deg,#FEF3C7,#FDE68A)":i===1?"linear-gradient(135deg,#F1F5F9,#E2E8F0)":"linear-gradient(135deg,#FEF3C7,#FBBF24,#F59E0B30)",border:"none"}}>
                <div style={{fontSize:32}}>{medals[i]}</div>
                <div style={{fontSize:28,marginBottom:4}}>{u.avatar||"👤"}</div>
                <div style={{fontWeight:800,fontSize:12,color:"#1E1B4B",marginBottom:2}}>{u.name.split(" ")[0]}</div>
                <div style={{fontWeight:900,fontSize:20,color:i===0?"#D97706":"#374151"}}>{u.avg}%</div>
                <div style={{fontSize:10,color:"#9CA3AF"}}>{u.count} тест</div>
              </div>
            ))}
          </div>
        )}
        {/* Full list */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ranked.map((u,i)=>{
            const isMe=u.id===String(user?.id)||u.id===user?.id;
            return(
              <div key={u.id} style={{...C.card,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,
                border:isMe?"2px solid #4F46E5":C.card.border,
                background:isMe?(darkMode?"rgba(79,70,229,0.2)":C.card.background):C.card.background}}>
                <div style={{fontWeight:900,fontSize:16,color:i<3?"#D97706":"#9CA3AF",minWidth:32,textAlign:"center"}}>{i<3?medals[i]:`#${i+1}`}</div>
                <div style={{fontSize:28}}>{u.avatar||"👤"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:darkMode?"#E2E8FF":"#1E1B4B"}}>{u.name}{isMe?" 👈":""}</div>
                  <div style={{fontSize:12,color:darkMode?"#9BA3BF":"#9CA3AF"}}>{u.count} тест тапсырды</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:900,fontSize:18,color:u.avg>=80?"#22C55E":u.avg>=60?"#F59E0B":"#EF4444"}}>{u.avg}%</div>
                  <div style={{fontSize:11,color:darkMode?"#9BA3BF":"#9CA3AF"}}>Үздік: {u.best}%</div>
                </div>
              </div>
            );
          })}
          {ranked.length===0&&(
            <div style={{...C.card,padding:40,textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:12}}>🏆</div>
              <div style={{fontWeight:700,fontSize:16,color:darkMode?"#9BA3BF":"#9CA3AF"}}>Әзірге рейтингте ешкім жоқ</div>
              <div style={{fontSize:13,color:darkMode?"#9BA3BF":"#9CA3AF",marginTop:6}}>Тест тапсырыңыз!</div>
            </div>
          )}
        </div>
      </div>
    );
  };


  /* ════════════════════════════════════════════════════════
     PAGE: ADMIN / CURATOR
  ════════════════════════════════════════════════════════ */
  const PageAdmin=()=>{
    const isCurator=user?.role==="curator";
    const isSuperAdmin=user?.role==="superadmin";

    const sideItems=isCurator
      ?[["content","📚","Сабақтар"],["videos","🎬","Видео сілтемелері"],["announce","📢","Жаңалықтар"]]
      :[["dash","🏠","Басты бет"],["users","👥","Оқушылар"],...(isSuperAdmin?[["staff","👨‍💼","Қызметкерлер"]]:[]),["content","📚","Сабақтар"],["videos","🎬","Видео сілтемелері"],["activation","🔑","Активация"],["variants","📋","Тест нұсқалары"],["announce","📢","Жаңалықтар"],...((content.reports||[]).length>0?[["reports","🚩",`Хабарлар (${(content.reports||[]).length})`]]:[["reports","🚩","Хабарлар"]]),["settings","⚙️","Баптаулар"]];

    const pageTitle={
      dash:"Басты бет",users:"Оқушылар мониторингі",staff:"Қызметкерлер",content:"Сабақтар",videos:"Видео сілтемелері",activation:"Активация коды",
      variants:"Тест нұсқалары",announce:"Жаңалықтар",reports:"🚩 Хабарланған сұрақтар",settings:"Баптаулар"
    }[adminTab]||"Панель";

    const pendingUsers=users.filter(u=>u.status==="pending");
    const activeStudents=users.filter(u=>u.role==="student"&&u.status!=="pending");
    const filteredStudents=activeStudents.filter(u=>
      u.name?.toLowerCase().includes(searchQ.toLowerCase())||
      u.email?.toLowerCase().includes(searchQ.toLowerCase())
    );

    // ── Sidebar ──
    const Sidebar=()=>(
      <div style={{width:260,minWidth:260,background:"#1A1A2E",minHeight:"100vh",display:"flex",flexDirection:"column",borderRadius:"0 0 0 0",flexShrink:0}}>
        {/* Logo */}
        <div style={{padding:"28px 24px 20px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🛡️</div>
            <div>
              <div style={{fontWeight:900,fontSize:17,color:"#fff",letterSpacing:-0.3}}>SmartAdmin</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:600,letterSpacing:1.5}}>БАСҚАРУ ОРТАЛЫҒЫ</div>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{flex:1,padding:"16px 12px",display:"flex",flexDirection:"column",gap:4}}>
          {sideItems.map(([t,icon,label])=>{
            const active=adminTab===t;
            return(
              <button key={t} onClick={()=>setAdminTab(t)} style={{
                display:"flex",alignItems:"center",gap:14,padding:"12px 16px",
                borderRadius:12,border:"none",cursor:"pointer",fontFamily:"inherit",
                background:active?"linear-gradient(135deg,#4F46E5,#7C3AED)":"transparent",
                color:active?"#fff":"rgba(255,255,255,0.55)",
                fontWeight:active?700:400,fontSize:14,
                textAlign:"left",transition:"all 0.15s",
              }}>
                <span style={{fontSize:18,width:22,textAlign:"center"}}>{icon}</span>
                <span>{label}</span>
                {t==="users"&&pendingUsers.length>0&&(
                  <span style={{marginLeft:"auto",background:"#EF4444",color:"#fff",borderRadius:99,fontSize:10,fontWeight:800,padding:"2px 7px"}}>{pendingUsers.length}</span>
                )}
              </button>
            );
          })}
        </nav>
        {/* User info */}
        <div style={{padding:"16px 20px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#F59E0B,#EF4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{user?.avatar||"👤"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user?.name}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{isSuperAdmin?"Супер Админ":isCurator?"Куратор":"Админ"}</div>
            </div>
            <button onClick={doLogout} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,padding:"6px 10px",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:12}}>Шығу</button>
          </div>
        </div>
      </div>
    );

    // ── DASH CONTENT ──
    const DashContent=()=>{
      const reports=content.reports||[];
      const premiumCount=activeStudents.filter(u=>u.plan==="premium").length;
      const todayResults=results.filter(r=>{const d=new Date(r.rawDate||r.date);const n=new Date();return d.getDate()===n.getDate()&&d.getMonth()===n.getMonth();});
      const avgScore=results.length?Math.round(results.reduce((a,b)=>a+b.score,0)/results.length):0;
      const totalVariants=Object.values(content.variants||{}).reduce((a,vs)=>a+(vs?.length||0),0);
      return(
      <div>
        {/* Reports alert */}
        {reports.length>0&&(
          <div style={{background:"#FEF2F2",border:"2px solid #FCA5A5",borderRadius:14,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:24}}>🚩</span>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,color:"#991B1B"}}>{reports.length} хабарланған сұрақ бар</div>
              <div style={{fontSize:12,color:"#B91C1C"}}>Соңғы: {reports[reports.length-1]?.from} — {reports[reports.length-1]?.qText?.slice(0,40)}...</div>
            </div>
            <button onClick={()=>setAdminTab("reports")} style={{background:"#EF4444",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Қарау</button>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:20}}>
          {[
            {l:"Барлық оқушылар",v:activeStudents.length,i:"👥",c:"#4F46E5",bg:"#EEF2FF",sub:`${premiumCount} премиум`},
            {l:"Бүгін тапсырылды",v:todayResults.length,i:"📝",c:"#EC4899",bg:"#FDF2FF",sub:`Барлығы: ${results.length}`},
            {l:"Орт. балл",v:avgScore+"%",i:"🎯",c:"#F59E0B",bg:"#FFFBEB",sub:"Барлық тесттер"},
            {l:"Тест нұсқалары",v:totalVariants,i:"📋",c:"#22C55E",bg:"#F0FFF4",sub:"13 пән"},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:16,padding:"16px",border:`1px solid ${s.c}22`}}>
              <div style={{fontSize:24,marginBottom:6}}>{s.i}</div>
              <div style={{fontSize:26,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:11,color:"#6B7280",marginTop:4,fontWeight:600}}>{s.l}</div>
              <div style={{fontSize:10,color:s.c,marginTop:2,opacity:0.8}}>{s.sub}</div>
            </div>
          ))}
        </div>
        <div style={{background:"#fff",borderRadius:16,padding:20,border:"1px solid #EEF0FF"}}>
          <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:"#1E1B4B"}}>📊 Пән статистикасы</div>
          {SUBJECTS.map(s=>{
            const sr=results.filter(r=>r.sid===s.id);
            const av=sr.length?Math.round(sr.reduce((a,b)=>a+b.score,0)/sr.length):0;
            return(
              <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{width:20}}>{s.icon}</span>
                <span style={{flex:1,fontSize:13,fontWeight:600,color:"#374151"}}>{s.name}</span>
                <span style={{fontSize:11,color:"#9CA3AF",width:50,textAlign:"right"}}>{sr.length} тест</span>
                <div style={{background:"#F3F4F6",borderRadius:99,height:6,width:100,flexShrink:0}}>
                  <div style={{background:s.color,height:6,borderRadius:99,width:`${av}%`,transition:"width 0.4s"}}/>
                </div>
                <span style={{fontWeight:800,color:s.color,fontSize:12,width:32,textAlign:"right"}}>{av}%</span>
              </div>
            );
          })}
        </div>
      </div>
      );
    };

    // ── USERS CONTENT ──
    const UsersContent=()=>(
      <div>
        {/* Pending banner */}
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button onClick={()=>{syncUsersFromSupabase();showToast("Supabase-тен жаңартылды 🔄");}}
            style={{background:"#EEF2FF",color:"#4F46E5",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 Жаңарту (Supabase)</button>
        </div>
        {pendingUsers.length>0&&(
          <div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:14,padding:"14px 18px",marginBottom:18}}>
            <div style={{fontWeight:800,fontSize:14,color:"#92400E",marginBottom:10}}>⏳ Растауды күтіп тұрған — {pendingUsers.length} оқушы</div>
            {pendingUsers.map(u=>(
              <div key={u.id} style={{background:"#fff",borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",border:"1px solid #FEF3C7"}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,fontSize:13}}>{u.name} <span style={{fontSize:11,color:"#9CA3AF"}}>• {u.email}</span></div>
                  <div style={{fontSize:11,color:"#92400E",marginTop:2}}>{(u.subjects||[]).map(sid=>SUBJECTS.find(s=>s.id===sid)?.name||sid).join(", ")}</div>
                </div>
                <div style={{background:"#F3F4F6",borderRadius:8,padding:"4px 12px",fontFamily:"monospace",fontWeight:900,fontSize:18,letterSpacing:4,color:"#1E1B4B"}}>{u.unlockCode}</div>
                <a href={"https://wa.me/"+(u.phone||"").replace(/[^0-9]/g,"")+"?text="+encodeURIComponent("Сәлем, "+u.name+"! SmartUBT активация кодыңыз: "+u.unlockCode)}
                  target="_blank" rel="noopener"
                  style={{background:"#25D366",color:"#fff",borderRadius:8,padding:"6px 12px",fontWeight:700,fontSize:12,textDecoration:"none"}}>💬 WA</a>
                <button onClick={()=>{
                  const plan=generateStudyPlan(u.subjects||[],null);
                  const updated={...u,plan:"premium",status:"active",studyPlan:plan,progress:{},scores:[]};
                  setUsers(p=>p.map(x=>x.id===u.id?updated:x));
                  showToast(u.name+" → Премиум ✅");
                  sbUpsertUser(updated); // sync to Supabase
                }} style={{background:"#4F46E5",color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>✅ Ашу</button>
                <button onClick={()=>{setUsers(p=>p.filter(x=>x.id!==u.id));showToast("Жойылды","err");}}
                  style={{background:"#FEF2F2",color:"#EF4444",border:"none",borderRadius:8,padding:"6px 10px",fontSize:13,cursor:"pointer"}}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* Header row */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",gap:8}}>
            <div style={{background:"#E0E7FF",color:"#4F46E5",borderRadius:99,padding:"6px 16px",fontWeight:700,fontSize:12}}>БАСТАПҚЫ ОҚУШЫЛАР</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Іздеу..." 
              style={{...C.input,width:180,borderRadius:10,minWidth:0}}/>
            <button onClick={()=>setAddStudentModal(true)} style={{...C.btn,...C.pri,padding:"9px 16px",fontSize:13,fontWeight:800,whiteSpace:"nowrap"}}>
              + Оқушы қосу
            </button>
            <button onClick={()=>{
              const allRes=gS("ubt3_results",[]);
              const rows=[["Аты-жөні","Email","Телефон","Жоспар","Пәндер","Тесттер","Орт.балл","Статус","Тіркелген"]];
              users.filter(u=>u.role==="student").forEach(u=>{
                const uRes=allRes.filter(r=>r.userId===u.id);
                const avg=uRes.length?Math.round(uRes.reduce((a,r)=>a+r.score,0)/uRes.length):0;
                rows.push([u.name,u.email,u.phone||"-",u.plan,(u.subjects||[]).join(";"),uRes.length,avg+"%",u.status||"active",u.createdAt||"-"]);
              });
              const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
              const a=document.createElement("a");
              a.href="data:text/csv;charset=utf-8,﻿"+encodeURIComponent(csv);
              a.download=`smartubt_students_${new Date().toLocaleDateString("kk-KZ").replace(/\//g,"-")}.csv`;
              a.click();
              showToast("Excel файлы жүктелді ✅");
            }} style={{...C.btn,background:"#22C55E",color:"#fff",padding:"9px 14px",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>
              📥 Excel
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{background:"#fff",borderRadius:16,overflow:"hidden",border:"1px solid #EEF0FF"}}>
          {/* Table header */}
          <div style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1.2fr auto",gap:12,padding:"12px 20px",background:"#F9FAFB",borderBottom:"1px solid #EEF0FF"}}>
            {["ОҚУШЫ","ПӘНДЕР / КОД","МЕРЗІМІ","БАЛЛ/XP","СТАТУС",""].map((h,i)=>(
              <div key={i} style={{fontSize:11,fontWeight:700,color:"#9CA3AF",letterSpacing:0.5}}>{h}</div>
            ))}
          </div>
          {filteredStudents.length===0&&(
            <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Оқушылар жоқ</div>
          )}
          {filteredStudents.map(u=>{
            const ur=results.filter(r=>r.userId===u.id);
            const xp=u.xp||0;
            const planColor=u.plan==="premium"?"#22C55E":u.plan==="basic"?"#4F46E5":"#9CA3AF";
            const planBg=u.plan==="premium"?"#F0FFF4":u.plan==="basic"?"#EEF2FF":"#F3F4F6";
            const planLabel=u.plan==="premium"?"PREMIUM":u.plan==="basic"?"BASIC":"FREE";
            return(
              <div key={u.id} style={{display:"grid",gridTemplateColumns:"2fr 2fr 1fr 1fr 1.2fr auto",gap:12,padding:"16px 20px",borderBottom:"1px solid #F3F4F6",alignItems:"center"}}>
                {/* Student */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:12,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:15,flexShrink:0}}>{(u.name||"?")[0]}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1E1B4B"}}>{u.name}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{u.email}</div>
                  </div>
                </div>
                {/* Subjects + code */}
                <div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                    {(u.subjects||[]).slice(0,3).map(sid=>{
                      const s=SUBJECTS.find(x=>x.id===sid);
                      return s?<span key={sid} style={{background:s.bg,color:s.color,borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{s.name.toUpperCase()}</span>:null;
                    })}
                  </div>
                  <div style={{fontSize:11,color:u.unlockCode?"#F59E0B":"#9CA3AF",fontWeight:600}}>
                    PIN: {u.unlockCode||"—"}
                  </div>
                </div>
                {/* Date */}
                <div style={{fontSize:12,color:"#9CA3AF"}}>{u.createdAt||"—"}</div>
                {/* XP */}
                <div style={{fontWeight:800,fontSize:14,color:"#F59E0B"}}>{xp.toLocaleString()} ★</div>
                {/* Status */}
                <div>
                  <span style={{background:planBg,color:planColor,borderRadius:99,padding:"4px 12px",fontSize:11,fontWeight:800}}>{planLabel}</span>
                  {u.plan!=="premium"&&u.unlockCode&&(
                    <button onClick={()=>{setUsers(p=>p.map(x=>x.id===u.id?{...x,plan:"premium"}:x));showToast(u.name+" → Premium ✅");}}
                      style={{display:"block",marginTop:4,background:"#EEF2FF",color:"#4F46E5",border:"none",borderRadius:8,padding:"3px 10px",fontSize:10,fontWeight:700,cursor:"pointer"}}>✅ Ашу</button>
                  )}
                </div>
                {/* Actions */}
                <div style={{display:"flex",gap:6}}>
                  <button style={{background:"#EEF2FF",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:14}} title="Өңдеу">✏️</button>
                  <button onClick={()=>{setUsers(p=>p.filter(x=>x.id!==u.id));showToast("Жойылды","err");}}
                    style={{background:"#FEF2F2",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",fontSize:14}} title="Жою">🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    const tabContent={
      staff:isSuperAdmin?(
        <div>
          {/* ── STAFF MANAGEMENT (Superadmin only) ── */}
          <div style={{...C.card,padding:20,marginBottom:16,background:"linear-gradient(135deg,#1E1B4B,#312E81)",color:"#fff",borderRadius:20}}>
            <div style={{fontWeight:900,fontSize:18,marginBottom:4}}>👨‍💼 Қызметкерлер басқармасы</div>
            <div style={{opacity:0.7,fontSize:13}}>Adminдер мен кураторларды тағайындаңыз</div>
          </div>

          {/* Current Staff */}
          <div style={{...C.card,padding:20,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>🏢 Ағымдағы қызметкерлер</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.filter(u=>u.role==="admin"||u.role==="curator"||u.role==="superadmin").map(u=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:"#F9FAFB",borderRadius:14,border:"1px solid #EEF0FF"}}>
                  <span style={{fontSize:28}}>{u.avatar||"👤"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14,color:"#1E1B4B"}}>{u.name}</div>
                    <div style={{fontSize:12,color:"#9CA3AF"}}>{u.email}</div>
                  </div>
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{
                      padding:"4px 12px",borderRadius:99,fontSize:11,fontWeight:800,
                      background:u.role==="superadmin"?"linear-gradient(135deg,#7C3AED,#4F46E5)":u.role==="admin"?"#1E1B4B":"#0EA5E9",
                      color:"#fff"
                    }}>
                      {u.role==="superadmin"?"🚀 Супер Адмін":u.role==="admin"?"⚙️ Адмін":"👩‍🏫 Куратор"}
                    </span>
                    {u.role!=="superadmin"&&(
                      <select value={u.role} onChange={e=>{
                        setUsers(p=>p.map(x=>x.id===u.id?{...x,role:e.target.value}:x));
                        showToast(u.name+" рөлі өзгертілді ✅");
                      }} style={{...C.input,padding:"5px 10px",fontSize:12,width:"auto",borderRadius:10}}>
                        <option value="student">Оқушы</option>
                        <option value="curator">Куратор</option>
                        <option value="admin">Адмін</option>
                      </select>
                    )}
                    {u.role!=="superadmin"&&(
                      <button onClick={()=>{
                        setUsers(p=>p.map(x=>x.id===u.id?{...x,role:"student"}:x));
                        showToast(u.name+" оқушы рөліне өзгертілді");
                      }} style={{...C.btn,...C.danger,padding:"5px 10px",fontSize:11}}>
                        Алу
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {users.filter(u=>u.role==="admin"||u.role==="curator").length===0&&(
                <div style={{textAlign:"center",color:"#9CA3AF",padding:20}}>Қызметкерлер жоқ</div>
              )}
            </div>
          </div>

          {/* Assign Role to existing user */}
          <div style={{...C.card,padding:20,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>🎯 Оқушыға рөл тағайындау</div>
            <div style={{fontSize:13,color:"#6B7280",marginBottom:12}}>Тіркелген оқушыны адмін немесе куратор ретінде тағайындаңыз</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {users.filter(u=>u.role==="student").slice(0,50).map(u=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#F9FAFB",borderRadius:12,border:"1px solid #EEF0FF"}}>
                  <span style={{fontSize:22}}>{u.avatar||"👤"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13,color:"#1E1B4B"}}>{u.name}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{u.email}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{
                      setUsers(p=>p.map(x=>x.id===u.id?{...x,role:"curator"}:x));
                      showToast(u.name+" куратор тағайындалды 👩‍🏫");
                    }} style={{...C.btn,background:"#0EA5E9",color:"#fff",padding:"5px 12px",fontSize:11,fontWeight:700}}>
                      👩‍🏫 Куратор
                    </button>
                    <button onClick={()=>{
                      setUsers(p=>p.map(x=>x.id===u.id?{...x,role:"admin"}:x));
                      showToast(u.name+" адмін тағайындалды ⚙️");
                    }} style={{...C.btn,background:darkMode?"#0A0A1A":"#1E1B4B",color:"#fff",padding:"5px 12px",fontSize:11,fontWeight:700}}>
                      ⚙️ Адмін
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add new staff directly */}
          <div style={{...C.card,padding:20}}>
            <div style={{fontWeight:800,fontSize:16,marginBottom:14}}>➕ Жаңа қызметкер қосу</div>
            <AddStaffForm users={users} setUsers={setUsers} showToast={showToast} C={C}/>
          </div>
        </div>
      ):null,
      dash:<DashContent/>,
      users:<UsersContent/>,
      content:<AdminContentManager content={content} setContent={setContent} showToast={showToast}/>,
      activation:<ActivationAdminPanel showToast={showToast} C={C} users={users}/>,
      videos:<VideoAdminPanel chapters={(content.topics||{}).chemistry||[]} lessonMedia={lessonMedia} setLessonMedia={setLessonMedia} user={user} showToast={showToast} C={C}/>,
      variants:(
        <AdminVariantManager content={content} setContent={setContent} showToast={showToast}/>
      ),
      announce:(
        <div>
          <div style={{...C.card,padding:20,marginBottom:20}}>
            <h3 style={{fontWeight:800,fontSize:17,marginBottom:16}}>📢 Жаңа хабарландыру</h3>
            <AdminAddAnnounce content={content} setContent={setContent} users={users} setUsers={setUsers} user={user} showToast={showToast}/>
          </div>
          <h3 style={{fontWeight:800,marginBottom:12}}>Барлық хабарландырулар</h3>
          {(content.announcements||[]).map((a,i)=>(
            <div key={i} style={{...C.card,marginBottom:10,padding:16,borderLeft:`4px solid ${a.type==="info"?"#3B82F6":a.type==="success"?"#22C55E":a.type==="warning"?"#F59E0B":"#EF4444"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div>
                  {a.pinned&&<div style={{fontSize:10,fontWeight:700,color:"#F59E0B",marginBottom:4}}>📌 БЕКІТІЛГЕН</div>}
                  <div style={{fontWeight:800,marginBottom:4}}>{a.title}</div>
                  <div style={{fontSize:13,color:"#6B7280"}}>{a.body}</div>
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:6}}>{a.author} • {a.date}</div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button style={{...C.btn,...C.warn,fontSize:12,padding:"5px 10px"}} onClick={()=>{setContent(p=>({...p,announcements:p.announcements.map((x,j)=>j===i?{...x,pinned:!x.pinned}:x)}));showToast(a.pinned?"Бекіту алынды":"Бекітілді")}}>{a.pinned?"📌 Алу":"📌 Бекіту"}</button>
                  <button style={{...C.btn,...C.danger,fontSize:12,padding:"5px 10px"}} onClick={()=>{setContent(p=>({...p,announcements:p.announcements.filter((_,j)=>j!==i)}));showToast("Жойылды","err")}}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
      reports:(
        <div>
          <div style={{...C.card,padding:20,marginBottom:16,background:darkMode?"rgba(239,68,68,0.1)":"#FEF2F2",border:"2px solid #FCA5A5"}}>
            <div style={{fontWeight:900,fontSize:17,color:"#991B1B",marginBottom:4}}>🚩 Хабарланған сұрақтар</div>
            <div style={{fontSize:13,color:"#B91C1C"}}>Оқушылар хабарлаған қате немесе түсінбейтін сұрақтар</div>
          </div>
          {(content.reports||[]).length===0?(
            <div style={{...C.card,padding:40,textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:8}}>✅</div>
              <div style={{color:"#9CA3AF"}}>Хабарланған сұрақтар жоқ</div>
            </div>
          ):(
            <div>
              {[...(content.reports||[])].reverse().map((r,i)=>(
                <div key={i} style={{...C.card,padding:16,marginBottom:10,borderLeft:"4px solid #EF4444"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:8}}>
                    <div>
                      <span style={{background:"#FEE2E2",color:"#991B1B",borderRadius:99,padding:"2px 10px",fontSize:11,fontWeight:700,marginRight:8}}>
                        {r.type==="wrong_answer"?"❌ Жауап қате":r.type==="unclear"?"❓ Түсініксіз":"⚠️ Басқа"}
                      </span>
                      <span style={{fontSize:12,color:"#9CA3AF"}}>{r.from} • {r.date}</span>
                    </div>
                    <button onClick={()=>{
                      setContent(p=>({...p,reports:(p.reports||[]).filter((_,ri)=>ri!==(p.reports.length-1-i))}));
                      showToast("Жойылды ✅");
                    }} style={{background:"none",border:"1px solid #FCA5A5",borderRadius:8,padding:"3px 10px",fontSize:11,color:"#EF4444",cursor:"pointer"}}>Жою</button>
                  </div>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:darkMode?"#E2E8FF":"#1E1B4B"}}>{r.qText}</div>
                  {r.reason&&<div style={{fontSize:13,color:"#6B7280",background:darkMode?"rgba(255,255,255,0.05)":"#F9FAFB",borderRadius:8,padding:"8px 12px"}}>💬 {r.reason}</div>}
                  <div style={{fontSize:11,color:"#9CA3AF",marginTop:8}}>Пән ID: {r.sid} • Сұрақ #{r.idx+1}</div>
                </div>
              ))}
              <button onClick={()=>{
                if(window.confirm("Барлық хабарламаларды жою?")){
                  setContent(p=>({...p,reports:[]}));
                  showToast("Барлығы жойылды ✅");
                }
              }} style={{...C.btn,background:"#EF4444",color:"#fff",width:"100%",padding:12,marginTop:4}}>
                🗑 Барлығын жою
              </button>
            </div>
          )}
        </div>
      ),
      settings:(
        <div>
          {/* Reports from students */}
          {(content.reports||[]).length>0&&(
            <div style={{...C.card,padding:20,marginBottom:16,border:"2px solid #FCA5A5",background:"#FFF5F5"}}>
              <div style={{fontWeight:800,fontSize:16,marginBottom:12,color:"#991B1B"}}>🚩 Оқушы хабарламалары ({content.reports.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(content.reports||[]).map((r,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:12,padding:"12px 16px",border:"1px solid #FCA5A5"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1E1B4B",flex:1}}>{r.qText||"Сұрақ"}</div>
                      <button onClick={()=>setContent(p=>({...p,reports:p.reports.filter((_,j)=>j!==i)}))}
                        style={{...C.btn,padding:"3px 10px",fontSize:11,background:"#EEF0FF",color:"#4F46E5",flexShrink:0,marginLeft:8}}>
                        ✓ Шешілді
                      </button>
                    </div>
                    <div style={{fontSize:12,color:"#6B7280"}}>Себеп: {r.reason} | Кім: {r.from} | {r.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <PasswordChangeForm user={user} updateUser={updateUser} setUsers={setUsers} showToast={showToast} C={C}/>
          {/* Нұсқаларды жаңарту */}
          <div style={{...C.card,padding:20,marginBottom:16,background:"#EEF2FF",border:"2px solid #C7D2FE"}}>
            <div style={{fontWeight:800,fontSize:15,marginBottom:4,color:"#4F46E5"}}>🔄 Тест нұсқаларын жаңарту</div>
            <p style={{color:"#6B7280",fontSize:13,marginBottom:12}}>Тест нұсқалары көрінбесе немесе бос болса — осы батырманы басыңыз.</p>
            <button style={{...C.btn,...C.pri,padding:"10px 20px",fontSize:13}} onClick={()=>{
              setContent(p=>{
                  const baseVars={...INIT_VARIANTS};
                  const savedVs=p.variants||{};
                  const merged={};
                  Object.keys(baseVars).forEach(sid=>{
                    const initVs=baseVars[sid]||[];
                    const initIds=new Set(initVs.map(v=>v.id));
                    const adminAdded=(savedVs[sid]||[]).filter(v=>!initIds.has(v.id));
                    merged[sid]=[...initVs,...adminAdded];
                  });
                  return {...p,variants:merged};
                });
              showToast("Тест нұсқалары жаңартылды ✅");
            }}>🔄 Нұсқаларды жаңарту</button>
          </div>
          {/* UBT Exam Date */}
            <div style={{...C.card,padding:20,marginBottom:16,background:darkMode?"rgba(245,158,11,0.1)":"#FFFBEB",border:"2px solid #FCD34D"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:4,color:"#92400E"}}>📅 ҰБТ емтихан күні</div>
              <p style={{color:"#B45309",fontSize:13,marginBottom:10}}>Үй бетінде кері санауыш осы күнге дейін санайды.</p>
              <input type="date" defaultValue={ubtDate} style={{...C.input,marginBottom:8}}
                onBlur={e=>{if(e.target.value){setUbtDate(e.target.value);localStorage.setItem('ubt_exam_date',e.target.value);showToast("ҰБТ күні сақталды ✅");}}}/>
              <div style={{fontSize:12,color:"#92400E",fontWeight:700}}>
                ⏳ {(()=>{const d=Math.max(0,Math.ceil((new Date(ubtDate)-new Date())/86400000));return `${d} күн қалды`;})()}
              </div>
            </div>
          {/* Dark mode toggle */}
            <div style={{...C.card,padding:20,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,marginBottom:2}}>{darkMode?"🌙 Қараңғы режим":"☀️ Жарық режим"}</div>
                <div style={{fontSize:12,color:"#9CA3AF"}}>Интерфейс түсін ауыстыру</div>
              </div>
              <div onClick={()=>setDarkMode(d=>!d)} style={{width:52,height:28,borderRadius:99,background:darkMode?"#4F46E5":"#D1D5DB",cursor:"pointer",position:"relative",transition:"background 0.3s",flexShrink:0}}>
                <div style={{position:"absolute",top:3,left:darkMode?26:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left 0.3s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
              </div>
            </div>
          <div style={{...C.card,padding:24,marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:4}}>📲 WhatsApp номері</div>
            <p style={{color:"#6B7280",fontSize:13,marginBottom:12}}>Оқушылар төлем жасаған соң осы номерге хабарласады.</p>
            <input defaultValue={content?.settings?.whatsappNum||"+7 777 190 27 96"} style={C.input} placeholder="+7 777 XXX XX XX"
              onBlur={e=>setContent(p=>({...p,settings:{...(p.settings||{}),whatsappNum:e.target.value}}))}/>
          </div>
          <div style={{...C.card,padding:24}}>
            <div style={{fontWeight:800,fontSize:17,marginBottom:4}}>🔓 Тегін сабақтар</div>
            <p style={{color:"#6B7280",fontSize:13,marginBottom:14}}>Тегін оқушылар ашық көре алатын сабақтар.</p>
            {SUBJECTS.map(s=>{
              const tops=(content.topics?.[s.id]||[]);
              const lessons=tops.flatMap(t=>(t.lessons||[]).map(l=>({...l,topicTitle:t.title})));
              if(!lessons.length)return null;
              return(<div key={s.id} style={{marginBottom:14}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{s.icon} {s.name}</div>
                {lessons.map(l=>{
                  const unlocked=(content.unlockedLessons?.[s.id]||[]).includes(l.id);
                  return(<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:5,background:unlocked?"#F0FFF4":"#FAFAFE",borderRadius:10,padding:"7px 12px",border:`1px solid ${unlocked?"#86EFAC":"#EEF0FF"}`}}>
                    <div style={{flex:1,fontSize:12}}>{l.topicTitle} → {l.title}</div>
                    <button onClick={()=>{const cur=content.unlockedLessons?.[s.id]||[];setContent(p=>({...p,unlockedLessons:{...p.unlockedLessons,[s.id]:unlocked?cur.filter(x=>x!==l.id):[...cur,l.id]}}));}}
                      style={{...C.btn,padding:"3px 10px",fontSize:11,fontWeight:700,background:unlocked?"#FEF2F2":"#EEF2FF",color:unlocked?"#EF4444":"#4F46E5"}}>{unlocked?"🔒 Жабу":"🔓 Ашу"}</button>
                  </div>);
                })}
              </div>);
            })}
          </div>
        </div>
      ),
    };

    return(
      <div style={{display:"flex",minHeight:"100dvh",marginTop:-16,marginLeft:-12,marginRight:-12,marginBottom:"calc(-72px - env(safe-area-inset-bottom,0px))",background:"#F1F5F9"}}>
        <Sidebar/>
        {/* Main content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,overflow:"auto"}}>
          {/* Top bar */}
          <div style={{background:"#fff",borderBottom:"1px solid #EEF0FF",padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <h1 style={{fontWeight:900,fontSize:22,color:"#1E1B4B",margin:0}}>{pageTitle}</h1>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setPage("home")} style={{background:"#F3F4F6",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,cursor:"pointer",color:"#6B7280",fontWeight:600}}>← Оқушы бетіне</button>
            </div>
          </div>
          {/* Content */}
          <div style={{flex:1,padding:"clamp(12px,3vw,28px)",overflowY:"auto",minHeight:0,background:darkMode?"#111827":"#F1F5F9"}}>
            {tabContent[adminTab]||tabContent.dash}
          </div>
        </div>
      </div>
    );
  };

/* ════════════════════════════════════════════════════════
     ROUTING
  ════════════════════════════════════════════════════════ */

  const PaymentModal=()=>{
      const [step,setStep]=useState(0);
      const [selPkg,setSelPkg]=useState(null);
      const [method,setMethod]=useState("kaspi");
      const [phone,setPhone]=useState(user?.phone||"");
      const [codeInput,setCodeInput]=useState("");
      const WA_NUM=content?.settings?.whatsappNum||"+7 777 190 27 96";
      // Rules of Hooks: early return MUST be after all hooks
      if(!adminModal||adminModal.type!=="payment")return null;
    
      const selectedPkg=PACKAGES.find(p=>p.id===selPkg);
      const price=selectedPkg?.price||0;
    
      // Step 0: Choose what to pay for
      if(step===0)return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16,overflowY:"auto"}}>
          <div style={{...C.card,padding:24,maxWidth:500,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 style={{fontWeight:900,fontSize:18}}>📦 Пакет таңдаңыз</h3>
              <button style={{...C.btn,...C.danger,padding:"4px 10px",fontSize:13}} onClick={()=>setAdminModal(null)}>✕</button>
            </div>
            {PACKAGES.map(pk=>(
              <div key={pk.id} onClick={()=>setSelPkg(pk.id)} style={{...C.card,marginBottom:8,padding:14,cursor:"pointer",border:`2px solid ${selPkg===pk.id?pk.color:"#EEF0FF"}`,background:selPkg===pk.id?pk.color+"0D":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:24}}>{pk.icon}</span>
                  <div>
                    <div style={{fontWeight:900,fontSize:14,color:pk.color}}>{pk.name}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{pk.desc}</div>
                  </div>
                </div>
                <div style={{fontWeight:900,fontSize:15}}>{pk.price.toLocaleString()} ₸</div>
              </div>
            ))}
            <button disabled={!selPkg} style={{...C.btn,...C.pri,width:"100%",padding:14,marginTop:16,opacity:selPkg?1:0.5}} onClick={()=>setStep(1)}>
              {selPkg?selectedPkg.name+" — "+price.toLocaleString()+" ₸ Төлеуге →":"Пакет таңдаңыз"}
            </button>
          </div>
        </div>
      );
    
      // Step 1: Payment
      if(step===1)return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
          <div style={{...C.card,padding:24,maxWidth:440,width:"100%"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <button style={{...C.btn,...C.sec,padding:"6px 12px",fontSize:13}} onClick={()=>setStep(0)}>← Артқа</button>
              <h3 style={{fontWeight:900,fontSize:16}}>💳 Төлем</h3>
              <button style={{...C.btn,...C.danger,padding:"4px 10px",fontSize:13}} onClick={()=>setAdminModal(null)}>✕</button>
            </div>
            <div style={{background:selectedPkg.color+"12",border:`2px solid ${selectedPkg.color}`,borderRadius:14,padding:16,marginBottom:16,textAlign:"center"}}>
              <div style={{fontWeight:900,fontSize:18,color:selectedPkg.color}}>{selectedPkg.name}</div>
              <div style={{fontSize:32,fontWeight:900,color:"#1E1B4B",lineHeight:1}}>{price.toLocaleString()} ₸</div>
              <div style={{fontSize:12,color:"#9CA3AF",marginTop:4}}>{selectedPkg.desc}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {[{v:"kaspi",l:"Kaspi",i:"🟠"}].map(m=>(
                <div key={m.v} onClick={()=>setMethod(m.v)} style={{borderRadius:12,padding:12,textAlign:"center",border:`2px solid ${method===m.v?"#4F46E5":"#EEF0FF"}`,background:method===m.v?"#EEF2FF":"#FAFAFE",cursor:"pointer"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{m.i}</div>
                  <div style={{fontSize:11,fontWeight:700,color:method===m.v?"#4F46E5":"#6B7280"}}>{m.l}</div>
                </div>
              ))}
            </div>
            {method==="kaspi"&&(
              <div style={{background:"#FFF8E1",borderRadius:12,padding:16,marginBottom:14}}>
                <div style={{fontWeight:700,marginBottom:8,fontSize:14}}>📱 Kaspi.kz арқылы:</div>
                <div style={{fontSize:13,color:"#6B7280",lineHeight:1.8}}>
                  1. Kaspi → «Аударым» → Телефон<br/>
                  2. Нөмір: <b style={{color:"#F59E0B",fontSize:15}}>{WA_NUM}</b><br/>
                  3. Сома: <b style={{color:"#1E1B4B"}}>{price.toLocaleString()} ₸</b><br/>
                  4. Түсініктеме: <b>SmartUBT {selectedPkg.name}</b>
                </div>
              </div>
            )}
            {method==="card"&&(
              <div style={{marginBottom:14}}>
                <input placeholder="0000 0000 0000 0000" style={{...C.input,marginBottom:8}}/>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(140px,44%),1fr))",gap:8}}>
                  <input placeholder="ММ/ЖЖ" style={C.input}/>
                  <input placeholder="CVV" style={C.input}/>
                </div>
              </div>
            )}
            {method==="qr"&&(
              <div style={{background:"#F5F7FF",borderRadius:12,padding:20,marginBottom:14,textAlign:"center"}}>
                <div style={{width:130,height:130,background:"#fff",borderRadius:12,margin:"0 auto 8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:56}}>📱</div>
                <div style={{fontSize:12,color:"#6B7280"}}>QR кодты сканерлеңіз</div>
              </div>
            )}
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Телефон нөміріңіз" style={{...C.input,marginBottom:12}}/>
            <button style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15}} onClick={()=>setStep(2)}>
              Аударым жасадым ✓
            </button>
            
          </div>
        </div>
      );
    
      // Step 2: Payment confirmed → WhatsApp check
      if(step===2)return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
          <div style={{...C.card,padding:32,maxWidth:420,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:64,marginBottom:12}}>📲</div>
            <h3 style={{fontWeight:900,fontSize:22,color:"#4F46E5",marginBottom:8}}>Чекті жіберіңіз</h3>
            <div style={{color:"#6B7280",marginBottom:20,lineHeight:1.6}}>
              <b>{selectedPkg.name}</b> — {price.toLocaleString()} ₸
            </div>
            <div style={{background:"#F0FFF4",borderRadius:16,padding:20,marginBottom:20,textAlign:"left"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:12,textAlign:"center"}}>📲 Куратордан код алыңыз</div>
              <div style={{fontSize:13,color:"#374151",lineHeight:1.9}}>
                1. Чекті (скриншот) WhatsApp-қа жіберіңіз:<br/>
                <a href={"https://wa.me/"+WA_NUM.replace(/[^0-9]/g,"")} target="_blank" rel="noopener"
                  style={{display:"inline-flex",alignItems:"center",gap:6,background:"#25D366",color:"#fff",borderRadius:10,padding:"8px 16px",fontWeight:700,fontSize:14,textDecoration:"none",margin:"6px 0"}}>
                  📲 WhatsApp-қа жіберу: {WA_NUM}
                </a><br/>
                2. Куратор сізге <b>активация кодын</b> жібереді<br/>
                3. Кодты енгізіп, Премиум ашыңыз
              </div>
            </div>
            <button style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15}} onClick={()=>setStep(3)}>
              Код бар →
            </button>
          </div>
        </div>
      );
    
      // Step 3: Enter activation code
      if(step===3)return(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:500,padding:16}}>
          <div style={{...C.card,padding:32,maxWidth:400,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:52,marginBottom:12}}>🔑</div>
            <h3 style={{fontWeight:900,fontSize:20,marginBottom:6}}>Активация коды</h3>
            <p style={{color:"#9CA3AF",marginBottom:20}}>Куратор жіберген кодты енгізіңіз</p>
            <input value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())}
              placeholder="XXXXX" maxLength={10}
              style={{...C.input,textAlign:"center",fontSize:24,fontWeight:900,letterSpacing:6,marginBottom:16}}/>
            <button style={{...C.btn,...C.pri,width:"100%",padding:14,fontSize:15}} onClick={async()=>{
              const entered=codeInput.trim().toUpperCase();
              if(entered.length<6)return showToast("6 орынды кодты толық енгізіңіз","err");
              const res=await sbRpc("app_redeem_code",{p_token:APP_TOKEN,p_code:entered});
              if(res.ok&&res.data?.ok){
                updateUser({plan:res.data.user?.plan||"premium"});
                setAdminModal(null);
                showToast("Премиум белсендірілді! 🎉");
                return;
              }
              showToast(!res.ok?"Серверге қосыла алмадық":(res.data?.error==="session"?"Сессия аяқталды. Қайта кіріңіз":"Код дұрыс емес немесе қолданылған"),"err");
            }}>
              ✅ Кодты растап, Премиум ашу
            </button>
            <button style={{...C.btn,...C.sec,width:"100%",padding:10,marginTop:8,fontSize:13}} onClick={()=>setStep(2)}>
              ← Кодты әлі алмадым
            </button>
          </div>
        </div>
      );
    
      return null;
    };


  /* ── VARIANT PICKER MODAL ── */
  const VariantPickerModal=()=>{
    if(!variantPicker)return null;
    const sid=variantPicker.sid;
    const sub=SUBJECTS.find(s=>s.id===sid);
    const variants=content.variants?.[sid]||[];
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"clamp(8px,3vw,20px)",overflowY:"auto"}}>
        <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:"min(480px,100%)",padding:"clamp(16px,5vw,28px)",maxHeight:"85vh",overflowY:"auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div>
              <div style={{fontSize:28,marginBottom:4}}>{sub?.icon}</div>
              <h2 style={{fontWeight:900,fontSize:20,color:"#1E1B4B",margin:0}}>{sub?.name}</h2>
              <div style={{fontSize:13,color:"#9CA3AF",marginTop:2}}>Нұсқа таңдаңыз</div>
            </div>
            <button onClick={()=>setVariantPicker(null)} style={{background:"#F3F4F6",border:"none",borderRadius:10,padding:"8px 14px",fontSize:15,cursor:"pointer",color:"#6B7280"}}>✕</button>
          </div>
          {variants.length===0&&(
            <div style={{textAlign:"center",padding:32,color:"#9CA3AF"}}>
              <div style={{fontSize:40,marginBottom:8}}>📭</div>
              <div>Тест нұсқалары әлі қосылмаған</div>
            </div>
          )}
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {variants.map((v,i)=>(
              <button key={v.id} onClick={()=>startVariantTest(sid,v.id)} style={{
                display:"flex",alignItems:"center",gap:14,padding:"16px 18px",
                borderRadius:14,border:"2px solid #EEF0FF",background:"#FAFAFE",
                cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s",
              }}>
                <div style={{width:44,height:44,borderRadius:12,background:`linear-gradient(135deg,${sub?.color||"#4F46E5"},#7C3AED)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:18,flexShrink:0}}>{i+1}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:800,fontSize:15,color:"#1E1B4B"}}>{v.title}</div>
                  <div style={{fontSize:12,color:"#9CA3AF",marginTop:2}}>{v.questions.length} сұрақ • {v.timeMin||80} минут</div>
                </div>
                <div style={{fontSize:20,color:"#9CA3AF"}}>›</div>
              </button>
            ))}
          </div>
          <div style={{marginTop:16,padding:"12px 16px",background:"#F8FAFF",borderRadius:12,fontSize:12,color:"#6B7280"}}>
            💡 ҰБТ стандарты бойынша тест тапсырасыз. Уақыт шектеулі — мұқият болыңыз.
          </div>
        </div>
      </div>
    );
  };




  


  
  /* ════════════════════════════════════════════════════════
     PAGE: FLASHCARDS
  ════════════════════════════════════════════════════════ */
  const PageFlashcard=()=>{
    const [fSid,setFSid]=React.useState((user?.subjects||[])[0]||"chemistry");
    const [fIdx,setFIdx]=React.useState(0);
    const [flipped,setFlipped]=React.useState(false);
    const [known,setKnown]=React.useState([]);
    const [unknown,setUnknown]=React.useState([]);
    const [mode,setMode]=React.useState("study"); // study|result

    const variants=content.variants?.[fSid]||[];
    const allQ=variants.flatMap(v=>v.questions||[]);
    const cards=allQ.filter((_,i)=>!known.includes(i)&&!unknown.includes(i));
    const total=allQ.length;
    const curr=cards[fIdx];
    const progress=Math.round(((known.length+unknown.length)/Math.max(total,1))*100);
    const sub=SUBJECTS.find(s=>s.id===fSid);

    const next=(k)=>{
      if(k) setKnown(p=>[...p,allQ.indexOf(curr)]);
      else setUnknown(p=>[...p,allQ.indexOf(curr)]);
      setFlipped(false);
      if(fIdx>=cards.length-1){
        setMode("result");
      } else {
        setFIdx(p=>Math.min(p,cards.length-2));
      }
    };
    const reset=()=>{setFIdx(0);setFlipped(false);setKnown([]);setUnknown([]);setMode("study");};

    if(mode==="result") return(
      <div style={{maxWidth:"min(600px,100%)",margin:"0 auto"}}>
        <h2 style={{fontWeight:900,fontSize:22,marginBottom:20}}>🎴 Флэшкарта нәтижесі</h2>
        <div style={{...C.card,padding:32,textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:64,marginBottom:12}}>🎉</div>
          <div style={{fontSize:22,fontWeight:900,color:"#22C55E",marginBottom:4}}>{known.length} білдім!</div>
          <div style={{fontSize:16,color:"#EF4444",marginBottom:4}}>{unknown.length} үйрену керек</div>
          <div style={{fontSize:13,color:"#9CA3AF",marginBottom:20}}>Барлығы: {total} карта</div>
          <div style={{background:"#EEF0FF",borderRadius:99,height:12,marginBottom:20}}>
            <div style={{background:"linear-gradient(90deg,#22C55E,#16A34A)",height:12,borderRadius:99,width:`${Math.round(known.length/Math.max(total,1)*100)}%`,transition:"width 1s"}}/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            {unknown.length>0&&<button style={{...C.btn,...C.warn,fontWeight:800}} onClick={()=>{
              const newCards=unknown.slice();setKnown([]);setUnknown([]);
              setFIdx(0);setFlipped(false);setMode("study");
            }}>🔄 Қайта ({unknown.length})</button>}
            <button style={{...C.btn,...C.pri}} onClick={reset}>↺ Барлығын қайта</button>
            <button style={{...C.btn,...C.sec}} onClick={()=>setPage("subjects")}>Пәнге оралу</button>
          </div>
        </div>
      </div>
    );

    return(
      <div style={{maxWidth:"min(600px,100%)",margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <h2 style={{fontWeight:900,fontSize:20}}>🎴 Флэшкарталар</h2>
          <select value={fSid} onChange={e=>{setFSid(e.target.value);reset();}}
            style={{...C.input,width:"auto",padding:"8px 14px",fontSize:13}}>
            {(user?.subjects||SUBJECTS.slice(0,6).map(s=>s.id)).map(sid=>{
              const s=SUBJECTS.find(x=>x.id===sid);
              return s?<option key={sid} value={sid}>{s.icon} {s.name}</option>:null;
            })}
          </select>
        </div>
        {/* Progress */}
        <div style={{...C.card,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,background:"#EEF0FF",borderRadius:99,height:8}}>
            <div style={{background:"linear-gradient(90deg,#4F46E5,#7C3AED)",height:8,borderRadius:99,width:`${Math.round((known.length+unknown.length)/Math.max(total,1)*100)}%`,transition:"width 0.5s"}}/>
          </div>
          <span style={{fontSize:12,color:"#6B7280",flexShrink:0}}>{known.length+unknown.length}/{total}</span>
          <span style={{fontSize:12,color:"#22C55E",flexShrink:0}}>✅{known.length}</span>
          <span style={{fontSize:12,color:"#EF4444",flexShrink:0}}>❌{unknown.length}</span>
        </div>
        {/* Card */}
        {curr?(
          <div>
            <div onClick={()=>setFlipped(f=>!f)} style={{
              ...C.card,minHeight:260,padding:32,cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              textAlign:"center",marginBottom:16,
              background:flipped?"linear-gradient(135deg,#EEF2FF,#F5F3FF)":C.card.background,
              border:flipped?"2px solid #4F46E5":"1px solid #EEF0FF",
              transition:"all 0.3s",userSelect:"none",
            }}>
              {!flipped?(
                <>
                  <div style={{fontSize:13,color:"#9CA3AF",marginBottom:16,fontWeight:600}}>СҰРАҚ (Жауапты көру үшін басыңыз)</div>
                  <div style={{fontSize:18,fontWeight:700,lineHeight:1.6,color:"#1E1B4B"}}>{curr.q}</div>
                  {curr.topic&&<div style={{marginTop:12,fontSize:12,color:"#A5B4FC",background:"#EEF0FF",padding:"4px 12px",borderRadius:99}}>{curr.topic}</div>}
                </>
              ):(
                <>
                  <div style={{fontSize:13,color:"#4F46E5",marginBottom:16,fontWeight:700}}>ДҰРЫС ЖАУАП</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#4F46E5",marginBottom:12}}>{curr.opts?.[curr.ans]}</div>
                  {curr.exp&&<div style={{fontSize:13,color:"#6B7280",lineHeight:1.6,background:"#F0F9FF",padding:"10px 14px",borderRadius:12}}>{curr.exp}</div>}
                  {/* All options */}
                  <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:6,width:"100%",maxWidth:360}}>
                    {(curr.opts||[]).map((opt,i)=>(
                      <div key={i} style={{
                        fontSize:13,padding:"6px 12px",borderRadius:10,textAlign:"left",
                        background:i===curr.ans?"#DCFCE7":flipped&&i===curr.ans?"#DCFCE7":"#F9FAFB",
                        color:i===curr.ans?"#166534":"#6B7280",
                        fontWeight:i===curr.ans?700:400,
                      }}>{["A","B","C","D"][i]}. {opt}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
            {flipped&&(
              <div style={{display:"flex",gap:10}}>
                <button style={{...C.btn,flex:1,background:"#FEF2F2",color:"#EF4444",border:"2px solid #FCA5A5",padding:16,fontWeight:800,fontSize:15}} onClick={()=>next(false)}>
                  ❌ Білмедім
                </button>
                <button style={{...C.btn,flex:1,background:"#DCFCE7",color:"#16A34A",border:"2px solid #86EFAC",padding:16,fontWeight:800,fontSize:15}} onClick={()=>next(true)}>
                  ✅ Білдім
                </button>
              </div>
            )}
            {!flipped&&(
              <div style={{textAlign:"center",color:"#9CA3AF",fontSize:13,marginTop:8}}>
                👆 Жауапты көру үшін картаны басыңыз
              </div>
            )}
          </div>
        ):(
          <div style={{...C.card,textAlign:"center",padding:48}}>
            <div style={{fontSize:52}}>🎴</div>
            <div style={{fontWeight:800,marginTop:8}}>Карта жоқ</div>
            <div style={{color:"#9CA3AF",marginTop:4,marginBottom:16}}>Бұл пән үшін нұсқалар қосылмаған</div>
            <button style={{...C.btn,...C.pri}} onClick={()=>setFSid((user?.subjects||[])[0]||"chemistry")}>Басқа пән</button>
          </div>
        )}
      </div>
    );
  };

    if(page==="flashcard")return <PageFlashcard/>;
  if(page==="parent")return <PageParent/>;
    if(page==="leaderboard")return <PageLeaderboard/>;
  
  /* ════ PAGE: PARENT PORTAL ════ */
  const PageParent=()=>{
    const [childEmail,setChildEmail]=React.useState("");
    const [child,setChild]=React.useState(null);
    const [err,setErr]=React.useState("");

    const findChild=()=>{
      const found=users.find(u=>u.email===childEmail.trim()&&u.role==="student");
      if(found){setChild(found);setErr("");}
      else setErr("Оқушы табылмады");
    };

    if(!child) return(
      <div style={{maxWidth:"min(500px,100%)",margin:"0 auto"}}>
        <div style={{...C.card,padding:32,textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:60,marginBottom:12}}>👨‍👩‍👧‍👦</div>
          <h2 style={{fontWeight:900,fontSize:22,marginBottom:8,color:C.text.color}}>Ата-ана порталы</h2>
          <p style={{color:"#9CA3AF",marginBottom:24,fontSize:14}}>Баланыздың прогресін қараңыз</p>
          <input value={childEmail} onChange={e=>setChildEmail(e.target.value)}
            style={{...C.input,marginBottom:12,textAlign:"center"}} placeholder="Баланың email-і"/>
          {err&&<div style={{color:"#EF4444",fontSize:13,marginBottom:10}}>{err}</div>}
          <button onClick={findChild} style={{...C.btn,...C.pri,width:"100%",padding:14,fontWeight:800}}>
            🔍 Іздеу
          </button>
        </div>
      </div>
    );

    const childResults=results.filter(r=>r.userId===child.id||r.userId===String(child.id));
    const avg=childResults.length?Math.round(childResults.reduce((a,r)=>a+r.score,0)/childResults.length):0;
    const best=childResults.length?Math.max(...childResults.map(r=>r.score)):0;
    const plan=PLANS.find(p=>p.id===child.plan)||PLANS[0];

    return(
      <div style={{maxWidth:"min(720px,100%)",margin:"0 auto"}}>
        <button onClick={()=>setChild(null)} style={{...C.btn,...C.sec,marginBottom:16,padding:"8px 16px",fontSize:13}}>← Артқа</button>
        {/* Child card */}
        <div style={{background:"linear-gradient(135deg,#1E1B4B,#4F46E5)",borderRadius:20,padding:24,marginBottom:16,color:"#fff"}}>
          <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:48}}>{child.avatar||"👤"}</div>
            <div>
              <div style={{fontWeight:900,fontSize:20}}>{child.name}</div>
              <div style={{opacity:0.7,fontSize:13}}>{child.email}</div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <span style={{background:"rgba(255,255,255,0.2)",borderRadius:99,padding:"3px 12px",fontSize:12,fontWeight:700}}>{plan.name}</span>
                <span style={{background:"rgba(255,255,255,0.15)",borderRadius:99,padding:"3px 12px",fontSize:12}}>🔥 {child.streak||0} күн</span>
                <span style={{background:"rgba(255,255,255,0.15)",borderRadius:99,padding:"3px 12px",fontSize:12}}>⭐ {child.xp||0} XP</span>
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
            {[["📝",childResults.length,"Тест"],["🎯",avg+"%","Орта балл"],["🏆",best+"%","Үздік"]].map(([ic,v,l],i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.12)",borderRadius:14,padding:16,textAlign:"center"}}>
                <div style={{fontSize:24}}>{ic}</div>
                <div style={{fontWeight:900,fontSize:22}}>{v}</div>
                <div style={{opacity:0.7,fontSize:11}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Recent results */}
        <div style={{...C.card,padding:20,marginBottom:16}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:14,color:C.text.color}}>📋 Соңғы нәтижелер</div>
          {childResults.length===0?<div style={{textAlign:"center",color:"#9CA3AF",padding:20}}>Нәтиже жоқ</div>:(
            childResults.slice(-10).reverse().map((r,i)=>{
              const sub=SUBJECTS.find(s=>s.id===r.sid);
              return(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #EEF0FF"}}>
                  <span style={{fontSize:22}}>{sub?.icon||"📝"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:13,color:C.text.color}}>{sub?.name||r.sid}</div>
                    <div style={{fontSize:11,color:"#9CA3AF"}}>{r.date}</div>
                  </div>
                  <div style={{fontWeight:900,fontSize:18,color:r.score>=70?"#22C55E":r.score>=50?"#F59E0B":"#EF4444"}}>{r.score}%</div>
                </div>
              );
            })
          )}
        </div>
        {/* Subjects */}
        <div style={{...C.card,padding:20}}>
          <div style={{fontWeight:800,fontSize:16,marginBottom:14,color:C.text.color}}>📚 Тіркелген пәндер</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(child.subjects||[]).map(sid=>{
              const sub=SUBJECTS.find(s=>s.id===sid);
              return sub?<span key={sid} style={{background:sub.bg,color:sub.color,borderRadius:99,padding:"6px 14px",fontSize:13,fontWeight:700}}>{sub.icon} {sub.name}</span>:null;
            })}
            {(!child.subjects||child.subjects.length===0)&&<span style={{color:"#9CA3AF",fontSize:13}}>Пән тіркелмеген</span>}
          </div>
        </div>
      </div>
    );
  };

    const toastNode=toast?(
      <div style={{position:"fixed",bottom:24,right:24,padding:"14px 22px",borderRadius:14,fontWeight:700,fontSize:14,zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",background:toast.type==="err"?'#FEF2F2':'#F0FFF4',color:toast.type==="err"?'#EF4444':'#22C55E',border:`2px solid ${toast.type==="err"?"#FCA5A5":"#86EFAC"}`,animation:"fadeUp 0.3s ease"}}>
          {toast.msg}
        </div>
    ):null;

  // Welcome / тіркелу / кіру беттерінде де хабарлама (toast) көрінуі үшін
  if(page==="welcome"||page==="register"||page==="login"||!user){
    const early=page==="register"?PageRegister():page==="login"?PageLogin():PageWelcome();
    return <>{early}{toastNode}</>;
  }

  const pageContent=()=>{
    if(page==="home")return PageHome();
    if(page==="subjects")return PageSubjects();
    if(page==="lessons")return PageLessons();
    if(page==="lesson")return PageLesson();
    if(page==="test")return PageTest();
    if(page==="result")return PageResult();
    if(page==="stats")return PageStats();
    if(page==="ai")return PageAI();
    if(page==="plan")return PageStudyPlan();
    if(page==="profile")return PageProfile();
    if(page==="ubt")return <PageUBT/>;
    if(page==="admin")return user?.role==="admin"||user?.role==="curator"||user?.role==="superadmin"?PageAdmin():<div style={{textAlign:"center",padding:60}}><div style={{fontSize:52}}>🔒</div><p style={{color:"#9CA3AF",marginTop:8}}>Рұқсат жоқ</p></div>;
    return PageHome();
  };

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        body{background:var(--bg-main,#F0F2FF);transition:background 0.3s}
        select,input,textarea{font-family:inherit;font-size:16px}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#C7D2FE;border-radius:99px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input:focus,textarea:focus,select:focus{border-color:#4F46E5!important;outline:none;box-shadow:0 0 0 3px rgba(79,70,229,0.12)}
        button:active{transform:scale(0.96)}
        button{touch-action:manipulation}
        iframe{display:block}
        .dark-card{background:var(--bg-card,#fff);border-color:var(--border-col,#EEF0FF)}
        @media(max-width:400px){.hide-sm{display:none!important}}
        @media(min-width:768px){.hide-md{display:none!important}}
        @media(max-width:900px){.desktop-only{display:none!important}}
        .line-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      `}</style>
      {/* Layout hooks қолданбайды: функция ретінде шақырамыз, әйтпесе әр жаңартуда бүкіл бет қайта құрылып, енгізілген мәтін жоғалады */}
      {Layout({children:pageContent()})}
      {adminModal?.type==="payment"&&<StableRender fn={PaymentModal}/>}
      {variantPicker&&<VariantPickerModal/>}
      {certModal&&<CertificateModal result={certModal} user={user} onClose={()=>setCertModal(null)}/>}
      {reportModal&&<ReportQuestionModal data={reportModal} onClose={()=>setReportModal(null)} onReport={(r)=>{
        setContent(p=>({...p,reports:[...(p.reports||[]),{...r,from:user?.name,date:new Date().toLocaleDateString("kk-KZ")}]}));
        showToast("Хабарлама жіберілді ✅");
      }}/>}
      {addStudentModal&&<AddStudentModal
        onClose={()=>setAddStudentModal(false)}
        onSave={(student)=>{setUsers(p=>[...p,student]);showToast(student.name+" қосылды ✅");setAddStudentModal(false);}}
        users={users}
        SUBJECTS={SUBJECTS}
        C={C}
      />}
      {user&&!(user.role==="admin"||user.role==="superadmin"||user.role==="curator")&&(()=>{
        const esc=(x)=>String(x||"").replace(/[&<>"']/g,"");
        const label=esc(user.name)+" • "+esc(user.phone||user.email);
        const svg='<svg xmlns="http://www.w3.org/2000/svg" width="340" height="220"><text x="20" y="130" transform="rotate(-24 170 110)" font-family="sans-serif" font-size="15" font-weight="700" fill="rgba(90,90,120,0.075)">'+label+'</text></svg>';
        return <div aria-hidden="true" style={{position:"fixed",inset:0,zIndex:998,pointerEvents:"none",backgroundImage:'url("data:image/svg+xml;utf8,'+encodeURIComponent(svg)+'")'}}/>;
      })()}
      {toastNode}
      {/* Admin/Curator quick-switch floating button */}
      {(user?.role==="admin"||user?.role==="superadmin"||user?.role==="curator")&&page!=="admin"&&(
        <button onClick={()=>setPage("admin")} style={{
          position:"fixed",bottom:96,right:16,zIndex:400,
          background:user?.role==="superadmin"?"linear-gradient(135deg,#7C3AED,#4F46E5)":
                     user?.role==="curator"?"linear-gradient(135deg,#EC4899,#8B5CF6)":
                     "linear-gradient(135deg,#1E1B4B,#4F46E5)",
          color:"#fff",border:"none",borderRadius:16,padding:"10px 16px",
          fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          boxShadow:"0 4px 20px rgba(79,70,229,0.5)",
          fontFamily:"inherit",
        }}>
          <span style={{fontSize:18}}>{user?.role==="superadmin"?"🚀":user?.role==="curator"?"👩‍🏫":"⚙️"}</span>
          Админ панелі
        </button>
      )}
      {notifOpen&&<div style={{position:"fixed",inset:0,zIndex:350}} onClick={()=>setNotifOpen(false)}/>}
    </>
  );
}

function PasswordChangeForm({user,updateUser,setUsers,showToast,C}){
  const [pw,setPw]=React.useState({cur:"",nw:"",nw2:""});
  const [busy,setBusy]=React.useState(false);
  const save=async()=>{
    if(busy)return;
    if(!pw.cur)return showToast("Қазіргі парольді енгізіңіз","err");
    if(pw.nw.length<6)return showToast("Кем дегенде 6 таңба","err");
    if(pw.nw!==pw.nw2)return showToast("Парольдер сәйкес келмейді","err");
    if(pw.nw===pw.cur)return showToast("Жаңа пароль ескісімен бірдей болмауы керек","err");
    // Supabase Auth арқылы тіркелген аккаунттар паролін email сілтемесі арқылы ауыстырады
    if(user.authId)return showToast("Бұл аккаунт үшін кіру бетіндегі «Құпия сөзді ұмыттым» арқылы ауыстырыңыз","err");
    setBusy(true);
    // Ескі пароль серверде тексеріледі, жаңасы серверде сақталады — әйтпесе келесі кіруде жұмыс істемейді
    const okServer=await sbChangePassword(user.email,pw.cur,pw.nw);
    setBusy(false);
    if(!okServer)return showToast("Пароль өзгертілмеді: қазіргі пароль қате немесе сервер жауап бермеді","err");
    setUsers(p=>p.map(u=>u.id===user.id?{...u,password:pw.nw}:u));
    updateUser({password:pw.nw});
    setPw({cur:"",nw:"",nw2:""});
    showToast("Пароль өзгертілді ✅");
  };
  return(
    <div style={{...C.card,padding:24,marginBottom:16}}>
      <div style={{fontWeight:800,fontSize:17,marginBottom:4}}>🔐 Құпия сөзді өзгерту</div>
      <p style={{color:"#6B7280",fontSize:13,marginBottom:14}}>Аккаунт қауіпсіздігі үшін паролді жаңартыңыз.</p>
      <input type="password" value={pw.cur} onChange={e=>setPw(p=>({...p,cur:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Қазіргі құпия сөз"/>
      <input type="password" value={pw.nw} onChange={e=>setPw(p=>({...p,nw:e.target.value}))} style={{...C.input,marginBottom:10}} placeholder="Жаңа құпия сөз (мин. 6 таңба)"/>
      <input type="password" value={pw.nw2} onChange={e=>setPw(p=>({...p,nw2:e.target.value}))} style={{...C.input,marginBottom:14}} placeholder="Жаңа құпия сөзді растаңыз"/>
      <button disabled={busy} style={{...C.btn,...C.pri,padding:"11px 24px",fontWeight:800,opacity:busy?0.6:1}} onClick={save}>{busy?"Сақталуда...":"🔐 Сақтау"}</button>
    </div>
  );
}

export default function SmartUBT(){
  return <ErrorBoundary><SmartUBTInner/></ErrorBoundary>;
}
