/* Student identity is local to this tab; shared connection remains separate. */
(function(){
 const areas=['Medical Surgical and ICU','Orthopedic Med-Surg','Progressive Care','Psychiatric','PEDS','OB'];
 let identity=null;
 const key=()=>STORAGE_KEY+'_student_session';
 window.studentSession=()=>identity?{...identity}:null;
 window.studentPatientAreas=function(p){
  if(Array.isArray(p.clinicalAreas)&&p.clinicalAreas.length)return p.clinicalAreas;
  const unit=String(p.unit||'');
  const mapped={'ruth-livingston':['Medical Surgical and ICU','Orthopedic Med-Surg'],'carl-shapiro':['Medical Surgical and ICU','Progressive Care'],'karl-sharp':['Medical Surgical and ICU','Progressive Care']};
  if(mapped[p.id])return mapped[p.id];
  if(/psych/i.test(unit))return ['Psychiatric'];
  if(/ortho/i.test(unit))return ['Orthopedic Med-Surg','Medical Surgical and ICU'];
  if(/progressive/i.test(unit))return ['Progressive Care','Medical Surgical and ICU'];
  const specialty=PATIENT_SPECIALTY_VIEWS[p.id]||[];
  if(/pedi|peds|neonat|nursery/i.test(unit)||specialty.includes('pews'))return ['PEDS'];
  if(/obst|labor|maternity/i.test(unit)||specialty.includes('prenatal'))return ['OB'];
  return ['Medical Surgical and ICU'];
 };
 window.studentPatientVisible=p=>getTabMode()!=='student'||!identity||studentPatientAreas(p).includes(identity.area);
 function closeLogin(){document.getElementById('studentCheckIn')?.remove();document.querySelector('aside')?.removeAttribute('inert');document.getElementById('view')?.removeAttribute('inert');}
 window.signOutStudent=function(){
  if(identity&&activePatientId)recordChartAccess(activePatientId,'Student signed out','Sign out');
  saveCurrentViewDraft();identity=null;sessionStorage.removeItem(key());activePatientId=null;currentView='patients';closeLogin();render();
 };
 window.checkInForChart=function(pid,open){
  if(identity){open();recordChartAccess(pid,'Patient Summary','Chart opened');return;}
  showLogin(()=>{open();recordChartAccess(pid,'Patient Summary','Chart opened');});
 };
 function showLogin(after){
  const existing=document.getElementById('studentCheckIn');if(existing){if(after)existing.afterLogin=after;return;}
  const host=document.createElement('div');host.id='studentCheckIn';host.className='popupOverlay';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','studentCheckInTitle');host.afterLogin=after;
  host.innerHTML=`<form class="popupCard" autocomplete="off"><div class="popupHead"><b id="studentCheckInTitle">Student Sign In</b></div><div class="popupBody"><p>Sign in for your simulation. Your name, group, and area will appear in the audit. Documentation fields remain blank.</p><label>First Name<input name="firstName" maxlength="80" required autocomplete="given-name"></label><label>Last Name<input name="lastName" maxlength="80" required autocomplete="family-name"></label><label>Clinical group / cohort (optional)<input name="group" maxlength="100" placeholder="e.g., Level 3 — Group A"></label><label>Clinical area<select name="area" required><option value="">Select your area</option>${areas.map(a=>`<option>${esc(a)}</option>`).join('')}</select></label><p id="checkInFeedback" role="status"></p></div><div class="popupActions"><button type="button" id="loginFaculty">Faculty Mode</button><button type="submit" class="primary">Sign In</button></div></form>`;
  document.body.append(host);host.querySelector('#loginFaculty').onclick=()=>toggleMode();document.querySelector('aside')?.setAttribute('inert','');document.getElementById('view')?.setAttribute('inert','');host.querySelector('input').focus();
  host.onkeydown=e=>{if(e.key==='Tab'){const controls=[...host.querySelectorAll('input,select,button')];if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0].focus();}}};
  host.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.target.elements,first=f.firstName.value.trim(),last=f.lastName.value.trim(),area=f.area.value;if(!first||!last||!areas.includes(area)){host.querySelector('#checkInFeedback').textContent='Enter your first and last name and select a clinical area.';return;}
   const next={name:first+' '+last,group:f.group.value.trim(),area,signedIn:new Date().toISOString()};
   try{sessionStorage.setItem(key(),JSON.stringify(next));}catch{host.querySelector('#checkInFeedback').textContent='This browser could not keep your sign-in. Enable browser storage and try again.';return;}
   identity=next;const callback=host.afterLogin;closeLogin();const firstPatient=state.patients.find(studentPatientVisible);if(firstPatient)patientLevelTab=Number(firstPatient.level||PATIENT_LEVELS[firstPatient.id]||1);currentView='patients';activePatientId=null;render();if(callback)callback();
  };
 }
 function sessionControls(){
  document.getElementById('studentSessionControls')?.remove();
  if(getTabMode()!=='student'){closeLogin();return;}
  if(!identity){showLogin();return;}
  const controls=document.createElement('div');controls.id='studentSessionControls';controls.style='padding:8px 16px;background:#eef5f2;border-bottom:1px solid #bccbc4';
  controls.innerHTML=`<b>${esc(identity.name)}</b> · ${identity.group?esc(identity.group)+' · ':''}${esc(identity.area)} <button id="studentSignOut">Sign Out</button>`;
  document.querySelector('header').after(controls);controls.querySelector('button').onclick=signOutStudent;
 }
 window.initializeStudentSession=function(){
  try{const saved=JSON.parse(sessionStorage.getItem(key())||'null');if(saved&&typeof saved.name==='string'&&saved.name.trim()&&areas.includes(saved.area))identity=saved;}catch{}
  const previous=render;render=function(...args){const result=previous(...args);sessionControls();return result;};
  sessionControls();
 };
})();
