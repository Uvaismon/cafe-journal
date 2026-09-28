const config = window.SUPABASE_CONFIG || {};
const configured = config.url && !config.url.includes("YOUR-PROJECT") && config.anonKey && !config.anonKey.includes("YOUR_");
const sb = configured ? supabase.createClient(config.url, config.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
}) : null;

const $ = id => document.getElementById(id);
let cafes = [];
let editingId = null;
let pendingPhotos = [];
let lightboxPhotos = [];
let lightboxIndex = 0;
let currentUser = null;
const photoObjectUrls = new Set();
let deletePermission = false;

function toast(msg){ $("toast").textContent=msg; $("toast").classList.add("show"); setTimeout(()=>$("toast").classList.remove("show"),9000); }
function apiErrorText(error){
  if(typeof error==="string")return error;
  if(!error)return "Unknown API error.";
  const parts=[error.message,error.details,error.hint,error.code?`Code: ${error.code}`:null].filter(Boolean);
  return parts.length?parts.join(" — "):String(error);
}
function showApiError(context,error,target){
  const message=`${context}: ${apiErrorText(error)}`;
  if(target)target.textContent=message;else toast(message);
}
function esc(s=""){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function stars(v){ if(!v) return "—"; const n=Math.round(Number(v)); return "★".repeat(n)+"☆".repeat(5-n); }
function overall(c){ const vals=[c.coffee,c.food,c.ambience,c.wifi].filter(v=>v!=null && v!=="").map(Number); return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null; }
function dateText(d){ if(!d) return "No date"; const x=new Date(d+"T00:00:00"); return x.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}); }
function canDeleteCafes(){return !!currentUser && deletePermission;}

function showAuth(){
  $("authView").classList.remove("hidden");
  syncAuthViewport();
  if(!configured) $("authMessage").textContent="Set up config.js first — see README.md.";
}
function syncAuthViewport(){
  const viewport=window.visualViewport;
  if(!viewport)return;
  const auth=$("authView");
  auth.style.setProperty("--visual-viewport-height",`${viewport.height}px`);
  auth.style.setProperty("--visual-viewport-offset-top",`${viewport.offsetTop}px`);
}
function showApp(user){
  const nextUser=user||null;
  if(currentUser?.id!==nextUser?.id)deletePermission=false;
  currentUser=nextUser;
  const authenticated=!!currentUser;
  $("authView").classList.toggle("hidden",authenticated);
  $("appView").classList.toggle("hidden",!authenticated);
  if(!authenticated){
    cafes=[];
    revokePhotoUrls();
    closeCafeDetails();
    closeLightbox();
  }
  $("addCafe").classList.toggle("hidden",!currentUser);
  $("signIn").classList.toggle("hidden",!!currentUser);
  $("signOut").classList.toggle("hidden",!currentUser);
  $("userEmail").textContent=currentUser?(currentUser.email || "Editor"):"Public visitor";
  $("avatar").textContent=currentUser?(currentUser.email||"E")[0].toUpperCase():"☕";
  render();
}

async function loadCafes(){
  if(!sb||!currentUser){cafes=[];render();return false}
  try{
  const {data,error}=await sb.from("cafes").select("*, cafe_photos(id,path)").order("visited_at",{ascending:false}).order("created_at",{ascending:false});
  if(error){ showApiError("Could not load café entries",error); return false; }
  cafes=data||[];
  await attachPhotoUrls(cafes);
  renderAmbientPhotos();
  render();
  if(!$("detailView").classList.contains("hidden")){
    const selected=cafes.find(cafe=>cafe.id===$("detailContent").dataset.cafeId);
    if(selected)renderCafeDetails(selected);
  }
  return true;
  }catch(error){showApiError("Could not load café entries",error);return false}
}

async function refreshDeletePermission(){
  if(!sb||!currentUser){deletePermission=false;render();return false}
  const userId=currentUser.id;
  try{
    const {data,error}=await sb.rpc("can_delete_cafes");
    if(error)throw error;
    if(currentUser?.id!==userId)return false;
    deletePermission=data===true;
    render();
    if(!$("detailView").classList.contains("hidden")){
      const cafe=cafes.find(item=>item.id===$("detailContent").dataset.cafeId);
      if(cafe)renderCafeDetails(cafe);
    }
    return deletePermission;
  }catch(error){
    if(currentUser?.id===userId){
      deletePermission=false;
      render();
      showApiError("Could not verify delete permission",error);
    }
    return false;
  }
}

async function attachPhotoUrls(list){
  revokePhotoUrls();
  for(const cafe of list){
    cafe.photoUrls=[];
    for(const p of (cafe.cafe_photos||[])){
      try{
        const {data,error}=await sb.storage.from("cafe-photos").download(p.path);
        if(error){showApiError(`Could not load photo for ${cafe.name}`,error);continue}
        if(data){const url=URL.createObjectURL(data);photoObjectUrls.add(url);cafe.photoUrls.push({id:p.id,url,path:p.path})}
      }catch(error){showApiError(`Could not load photo for ${cafe.name}`,error)}
    }
  }
}
function revokePhotoUrls(){
  for(const url of photoObjectUrls)URL.revokeObjectURL(url);
  photoObjectUrls.clear();
}
function photoMarkup(c){
  if(!c.photoUrls?.length) return "";
  return `<div class="cafe-photos">${c.photoUrls.slice(0,3).map((p,i)=>`<img class="cafe-photo" src="${p.url}" alt="Café photo" onclick="openLightbox('${c.id}',${i})">`).join("")}${c.photoUrls.length>3?`<span class="photo-count">+${c.photoUrls.length-3} more</span>`:""}</div>`;
}

function renderAmbientPhotos(){
  const layer=$("ambientPhotos");
  if(!layer)return;
  const photos=cafes.flatMap(c=>c.photoUrls||[]);
  for(let i=photos.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [photos[i],photos[j]]=[photos[j],photos[i]];
  }
  renderSidebarPhotos(photos);
  layer.replaceChildren(...photos.slice(0,6).map(photo=>{
    const frame=document.createElement("div");
    frame.className="ambient-photo";
    const image=document.createElement("img");
    image.src=photo.url;
    image.alt="";
    image.loading="lazy";
    frame.append(image);
    return frame;
  }));
}

function renderSidebarPhotos(photos){
  const strip=$("sidebarPhotos");
  if(!strip)return;
  strip.replaceChildren(...photos.slice(0,2).map(photo=>{
    const image=document.createElement("img");
    image.src=photo.url;
    image.alt="";
    image.loading="lazy";
    return image;
  }));
}

function render(){
  const q=($("search")?.value||"").toLowerCase().trim();
  const vibe=$("vibeFilter")?.value||"";
  const rf=$("ratingFilter")?.value||"";
  const filtered=cafes.filter(c=>{
    const text=[c.name,c.area,c.had,c.vibe,c.notes].join(" ").toLowerCase();
    const r=Number(c.overall_rating || overall(c) || 0);
    return (!q||text.includes(q)) && (!vibe||c.vibe===vibe) && (!rf||(rf==="5"?r>=5:r>=Number(rf)));
  });
  renderStats();
  renderGrid("recentGrid",cafes.slice(0,6));
  renderGrid("allGrid",filtered);
  renderGrid("favGrid",cafes.filter(c=>c.favourite));
}

function renderStats(){
  const count=cafes.length;
  const ratings=cafes.map(c=>Number(c.overall_rating ?? overall(c))).filter(Boolean);
  const avg=ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):"—";
  const spend=cafes.reduce((a,c)=>a+Number(c.spend||0),0);
  $("statCount").textContent=count;
  $("statRating").textContent=avg;
  $("statFav").textContent=cafes.filter(c=>c.favourite).length;
  $("statSpend").textContent="₹"+spend.toLocaleString("en-IN");
}

function renderGrid(id, list){
  const el=$(id); if(!el) return;
  if(!list.length){ el.innerHTML=`<div class="empty">☕<br><br>No café memories here yet.${currentUser?'<br><button class="primary" style="margin-top:14px" onclick="openModal()">Add your first one →</button>':""}</div>`; return; }
  el.innerHTML=list.map(c=>{
    const r=Number(c.overall_rating ?? overall(c) ?? 0);
    return `<article class="cafe-card" tabindex="0" aria-label="View details for ${esc(c.name)}" onclick="openCafeDetails('${c.id}',event)" onkeydown="openCafeDetails('${c.id}',event)">
      <div class="top"><div><h4>${esc(c.name)}</h4><div class="location">${esc(c.area||"A little corner somewhere")}</div></div><button type="button" class="heart" data-cafe-id="${c.id}" aria-label="${c.favourite?"Remove from favourites":"Add to favourites"}" aria-pressed="${!!c.favourite}" onclick="event.stopPropagation();toggleFavourite('${c.id}')">${c.favourite?"♥":"♡"}</button></div>
      <div class="rating">${stars(r)} <span style="color:#7a6f68;font-size:11px">${r?` ${r}`:""}</span></div>
      ${c.vibe||c.revisit==="Yes"?`<div class="card-tags">${c.vibe?`<span class="tag">${esc(c.vibe)}</span>`:""}${c.revisit==="Yes"?'<span class="tag revisit-tag"><span aria-hidden="true">↻</span> Revisit</span>':""}</div>`:""}
      ${c.notes?`<p class="note">“${esc(c.notes)}”</p>`:""}
      ${c.photoUrls?.length?`<div class="cafe-photos">${c.photoUrls.slice(0,3).map((p,i)=>`<img class="cafe-photo" src="${p.url}" alt="Café photo" onclick="event.stopPropagation();openLightbox('${c.id}',${i})">`).join("")}${c.photoUrls.length>3?`<span class="photo-count">+${c.photoUrls.length-3} more</span>`:""}</div>`:""}
      <div class="meta"><span>${dateText(c.visited_at)}</span><span>${c.spend?`₹${Number(c.spend).toLocaleString("en-IN")}`:""}</span></div>
      ${currentUser?`<div class="card-actions"><button onclick="event.stopPropagation();editCafe('${c.id}')">Edit</button>${canDeleteCafes()?`<button onclick="event.stopPropagation();deleteCafe('${c.id}')">Delete</button>`:""}</div>`:""}
    </article>`;
  }).join("");
}

function openCafeDetails(id,event){
  if(event?.target?.closest("button, img, a, input, select, textarea"))return;
  if(event?.type==="keydown" && event.key!=="Enter" && event.key!==" ")return;
  if(event?.type==="keydown")event.preventDefault();
  const cafe=cafes.find(item=>item.id===id);
  if(!cafe)return;
  renderCafeDetails(cafe);
  $("detailView").classList.remove("hidden");
  $("detailClose").focus();
}

function renderCafeDetails(c){
  $("detailContent").dataset.cafeId=c.id;
  const ratings=[
    ["Coffee",c.coffee],["Food",c.food],["Ambience",c.ambience],["Wi-Fi",c.wifi]
  ].filter(([,value])=>value!=null && value!=="");
  const rating=Number(c.overall_rating ?? overall(c) ?? 0);
  $("detailContent").innerHTML=`
    <header class="detail-heading">
      <div><p class="eyebrow">CAFÉ MEMORY</p><h1>${esc(c.name)}</h1><p class="detail-location">${esc(c.area||"A little corner somewhere")}</p></div>
      <button type="button" class="heart detail-heart" data-cafe-id="${c.id}" aria-label="${c.favourite?"Remove from favourites":"Add to favourites"}" aria-pressed="${!!c.favourite}" onclick="toggleFavourite('${c.id}')">${c.favourite?"♥":"♡"}</button>
    </header>
    <div class="detail-rating"><strong>${stars(rating)}</strong>${rating?`<span>${rating.toFixed(1)} / 5</span>`:"<span>No overall rating yet</span>"}</div>
    <div class="detail-tags">${c.vibe?`<span class="tag">${esc(c.vibe)}</span>`:""}${c.revisit==="Yes"?'<span class="tag revisit-tag">↻ Worth revisiting</span>':""}${c.favourite?'<span class="tag favourite-tag">♥ Favourite</span>':""}</div>
    ${c.photoUrls?.length?`<div class="detail-photos">${c.photoUrls.map((p,i)=>`<img src="${esc(p.url)}" alt="${esc(c.name)} café photo ${i+1}" loading="lazy" onclick="openLightbox('${c.id}',${i})">`).join("")}</div>`:""}
    <div class="detail-sections">
      <section class="detail-panel"><h2>Visit</h2><dl><div><dt>Date visited</dt><dd>${dateText(c.visited_at)}</dd></div><div><dt>Spent</dt><dd>${c.spend?`₹${Number(c.spend).toLocaleString("en-IN")}`:"Not recorded"}</dd></div><div><dt>Revisit</dt><dd>${esc(c.revisit||"Not decided")}</dd></div></dl></section>
      ${ratings.length?`<section class="detail-panel"><h2>Ratings</h2><dl>${ratings.map(([label,value])=>`<div><dt>${label}</dt><dd>${Number(value)} / 5</dd></div>`).join("")}</dl></section>`:""}
      ${c.had?`<section class="detail-panel"><h2>What I had</h2><p>${esc(c.had)}</p></section>`:""}
      ${c.notes?`<section class="detail-panel detail-notes"><h2>Notes</h2><p>${esc(c.notes)}</p></section>`:""}
    </div>
    ${currentUser?`<div class="detail-actions"><button type="button" class="secondary" onclick="editCafe('${c.id}')">Edit memory</button>${canDeleteCafes()?`<button type="button" class="danger-button" onclick="deleteCafe('${c.id}')">Delete memory</button>`:""}</div>`:""}
  `;
}

function closeCafeDetails(){$("detailView").classList.add("hidden")}

function switchView(view){
  document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
  $(view+"View").classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("pageTitle").textContent=view==="home"?"Your café journal":view==="cafes"?"All cafés":"Favourites";
}

function openModal(c=null){
  if(!currentUser){showAuth();return}
  editingId=c?.id||null;
  $("modalTitle").textContent=c?"Edit your memory":"Add a café";
  $("modalEyebrow").textContent=c?"EDIT MEMORY":"NEW MEMORY";
  $("cafeForm").reset();
  pendingPhotos=[];
  $("photoPreview").innerHTML="";
  if(c){
    $("cafeId").value=c.id;$("cafeName").value=c.name||"";$("area").value=c.area||"";$("visitedAt").value=c.visited_at||"";
    $("had").value=c.had||"";$("coffee").value=c.coffee??"";$("food").value=c.food??"";$("ambience").value=c.ambience??"";$("wifi").value=c.wifi??"";
    $("spend").value=c.spend??"";$("vibe").value=c.vibe||"";$("favourite").value=String(!!c.favourite);$("revisit").value=c.revisit||"Maybe";$("notes").value=c.notes||"";
  } else {$("visitedAt").value=new Date().toISOString().slice(0,10);}
  $("modal").classList.remove("hidden");
}
function closeModal(){$("modal").classList.add("hidden"); editingId=null;}

$("photos").addEventListener("change", e=>{
  pendingPhotos=[...e.target.files];
  $("photoPreview").innerHTML=pendingPhotos.map(f=>`<img class="photo-thumb" src="${URL.createObjectURL(f)}" alt="">`).join("");
});

async function uploadPhotos(cafeId, files){
  if(!files.length) return [];
  const issues=[];
  let userData,userError;
  try{
    ({data:userData,error:userError}=await sb.auth.getUser());
  }catch(error){
    issues.push(`Could not verify editor account: ${apiErrorText(error)}`);
    return issues;
  }
  if(userError){issues.push(`Could not verify editor account: ${apiErrorText(userError)}`);return issues}
  const user=userData?.user;
  if(!user){issues.push("Could not verify editor account. Sign in again and retry.");return issues}
  for(const file of files){
    try{
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=`${user.id}/${cafeId}/${crypto.randomUUID()}-${safe}`;
      const {error:uploadError}=await sb.storage.from("cafe-photos").upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError){issues.push(`${file.name}: upload failed — ${apiErrorText(uploadError)}`);continue}
      const {error:rowError}=await sb.from("cafe_photos").insert({cafe_id:cafeId,path});
      if(rowError){
        issues.push(`${file.name}: photo record failed — ${apiErrorText(rowError)}`);
        const {error:cleanupError}=await sb.storage.from("cafe-photos").remove([path]);
        if(cleanupError)issues.push(`${file.name}: cleanup failed — ${apiErrorText(cleanupError)}`);
      }
    }catch(error){
      issues.push(`${file.name}: ${apiErrorText(error)}`);
    }
  }
  return issues;
}

async function saveCafe(e){
  e.preventDefault(); if(!sb||!currentUser) return;
  const saveButton=$("saveCafe");
  if(saveButton.disabled)return;
  const originalLabel=saveButton.textContent;
  saveButton.disabled=true;
  saveButton.classList.add("is-loading");
  saveButton.setAttribute("aria-busy","true");
  saveButton.textContent="Saving…";
  try{
    const row={
      name:$("cafeName").value.trim(),area:$("area").value.trim()||null,visited_at:$("visitedAt").value||null,had:$("had").value.trim()||null,
      coffee:$("coffee").value?Number($("coffee").value):null,food:$("food").value?Number($("food").value):null,
      ambience:$("ambience").value?Number($("ambience").value):null,wifi:$("wifi").value?Number($("wifi").value):null,
      spend:$("spend").value?Number($("spend").value):null,vibe:$("vibe").value||null,favourite:$("favourite").value==="true",
      revisit:$("revisit").value,notes:$("notes").value.trim()||null
    };
    let res;
    let cafeId=editingId;
    if(editingId){
      res=await sb.from("cafes").update(row).eq("id",editingId).select("id").single();
    } else {
      res=await sb.from("cafes").insert(row).select("id").single();
      cafeId=res.data?.id;
    }
    if(res.error){showApiError("Could not save café",res.error);return}
    const photoIssues=cafeId && pendingPhotos.length?await uploadPhotos(cafeId,pendingPhotos):[];
    const wasEdit=!!editingId;
    closeModal();
    if(!await loadCafes())return;
    const savedMessage=wasEdit?"Memory updated ♥":"Café saved ♥";
    toast(photoIssues.length?`${savedMessage} Photo errors: ${photoIssues.join(" | ")}`:savedMessage);
  }catch(error){
    showApiError("Could not save café",error);
  }finally{
    saveButton.disabled=false;
    saveButton.classList.remove("is-loading");
    saveButton.removeAttribute("aria-busy");
    saveButton.textContent=originalLabel;
  }
}
async function deleteCafe(id){
  if(!currentUser){showAuth();return}
  if(!canDeleteCafes()){toast("This account does not have permission to delete cafés.");return}
  if(!confirm("Delete this café memory?")) return;
  try{
  const {data:photos,error:photoQueryError}=await sb.from("cafe_photos").select("path").eq("cafe_id",id);
  if(photoQueryError){showApiError("Could not load café photos for deletion",photoQueryError);return}

  const paths=(photos||[]).map(photo=>photo.path).filter(Boolean);
  const {data:deletedRows,error}=await sb.from("cafes").delete().eq("id",id).select("id");
  if(error){showApiError("Could not delete café",error);return}
  if(!deletedRows?.length){
    showApiError("Could not delete café","Supabase did not delete this row. Check the delete RLS policy and confirm this account is allowlisted.");
    return;
  }
  closeCafeDetails();
  const reloaded=await loadCafes();
  if(!reloaded){showApiError("Memory deleted, but the journal could not be refreshed","Reload the page to see the latest data.");return}
  if(paths.length){
    const {data:removedPhotos,error:storageError}=await sb.storage.from("cafe-photos").remove(paths);
    if(storageError){showApiError("Memory deleted, but photo cleanup failed",storageError);return}
    if(Array.isArray(removedPhotos)&&removedPhotos.length<paths.length){
      toast(`Memory removed, but Supabase only confirmed ${removedPhotos.length} of ${paths.length} photos deleted. Check the Storage delete policy.`);
      return;
    }
  }
  toast("Memory removed");
  }catch(error){showApiError("Could not delete café",error)}
}
function editCafe(id){if(!currentUser){showAuth();return}const c=cafes.find(x=>x.id===id);if(c){closeCafeDetails();openModal(c)}}
async function toggleFavourite(id){
  if(!currentUser){$("authMessage").textContent="Sign in as an editor to save favourites.";showAuth();return}
  const cafe=cafes.find(item=>item.id===id);
  if(!cafe)return;
  const nextFavourite=!cafe.favourite;
  const buttons=[...document.querySelectorAll(`.heart[data-cafe-id="${id}"]`)];
  buttons.forEach(button=>button.disabled=true);
  try{
    const {error}=await sb.from("cafes").update({favourite:nextFavourite}).eq("id",id);
    if(error){buttons.forEach(button=>button.disabled=false);showApiError("Could not update favourite",error);return}
    cafe.favourite=nextFavourite;
    render();
    if(!$("detailView").classList.contains("hidden"))renderCafeDetails(cafe);
  }catch(error){
    buttons.forEach(button=>button.disabled=false);
    showApiError("Could not update favourite",error);
  }
}

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!sb){showAuth();return}
  const email=$("email").value.trim(),password=$("password").value;
  $("authMessage").textContent="Working…";
  try{
    const res=await sb.auth.signInWithPassword({email,password});
    if(res.error){showApiError("Sign-in failed",res.error,$("authMessage"));return}
    $("authMessage").textContent="Signed in. Loading your journal…";
  }catch(error){showApiError("Sign-in failed",error,$("authMessage"))}
});
$("authForm").querySelectorAll("input").forEach(input=>input.addEventListener("focus",()=>{
  setTimeout(()=>input.scrollIntoView({block:"nearest",behavior:"smooth"}),250);
}));
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",syncAuthViewport);
  window.visualViewport.addEventListener("scroll",syncAuthViewport);
}
$("signIn").addEventListener("click",showAuth);
$("authClose").addEventListener("click",()=>$("authView").classList.add("hidden"));
$("signOut").addEventListener("click",async()=>{
  try{
    const {error}=await sb.auth.signOut();
    if(error){showApiError("Sign-out failed",error);return}
    showApp(null);
  }catch(error){showApiError("Sign-out failed",error)}
});
$("detailClose").addEventListener("click",closeCafeDetails);
$("detailView").addEventListener("click",e=>{if(e.target.id==="detailView")closeCafeDetails()});
$("addCafe").addEventListener("click",()=>openModal());
$("closeModal").addEventListener("click",closeModal);$("cancelModal").addEventListener("click",closeModal);
$("cafeForm").addEventListener("submit",saveCafe);
$("search").addEventListener("input",render);$("vibeFilter").addEventListener("change",render);$("ratingFilter").addEventListener("change",render);
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));

(async()=>{
  if(!sb){showApp(null);showAuth();return}
  let session=null;
  try{
    const {data,error}=await sb.auth.getSession();
    if(error)showApiError("Could not restore sign-in session",error);
    else session=data?.session||null;
  }catch(error){showApiError("Could not restore sign-in session",error)}
  showApp(session?.user||null);
  if(session?.user)await Promise.all([loadCafes(),refreshDeletePermission()]);
  sb.auth.onAuthStateChange((event,session)=>{
    if(event!=="SIGNED_IN"&&event!=="SIGNED_OUT")return;
    const nextUser=session?.user||null;
    if(nextUser?.id===currentUser?.id)return;
    showApp(nextUser);
    if(nextUser)setTimeout(()=>{loadCafes();refreshDeletePermission()},0);
  });
})();

function openLightbox(cafeId,index){
  const c=cafes.find(x=>x.id===cafeId); if(!c?.photoUrls?.length)return;
  lightboxPhotos=c.photoUrls; lightboxIndex=index;
  $("lightboxImg").src=lightboxPhotos[lightboxIndex].url;
  $("lightbox").classList.remove("hidden");
}
function closeLightbox(){$("lightbox").classList.add("hidden")}
function moveLightbox(delta){
  if(!lightboxPhotos.length)return;
  lightboxIndex=(lightboxIndex+delta+lightboxPhotos.length)%lightboxPhotos.length;
  $("lightboxImg").src=lightboxPhotos[lightboxIndex].url;
}
$("lightboxClose").addEventListener("click",closeLightbox);
$("lightboxPrev").addEventListener("click",()=>moveLightbox(-1));
$("lightboxNext").addEventListener("click",()=>moveLightbox(1));
$("lightbox").addEventListener("click",e=>{if(e.target.id==="lightbox")closeLightbox()});
document.addEventListener("keydown",e=>{
  if(!$("lightbox").classList.contains("hidden")){
    if(e.key==="Escape")closeLightbox();
    if(e.key==="ArrowLeft")moveLightbox(-1);
    if(e.key==="ArrowRight")moveLightbox(1);
    return;
  }
  if(e.key==="Escape"&&!$("detailView").classList.contains("hidden"))closeCafeDetails();
});
