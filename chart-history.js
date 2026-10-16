/* Shared timestamp formatting and chart history placement; no activity tracking. */
(function(){
 window.formatChartTimestamp=function(value){
  const text=String(value??''),match=text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  if(!match)return text;
  if(!match[6])return `${match[4]}:${match[5]}_${match[2]}/${match[3]}/${match[1]}`;
  const date=new Date(text);if(!Number.isFinite(date.getTime()))return text;
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.hour}:${parts.minute}_${parts.month}/${parts.day}/${parts.year}`;
 };
window.initializeChartHistory=function(){
  const formatHistory=()=>{
   const root=window.document?.getElementById('view');if(!root)return;
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
   while(node=walker.nextNode()){
    if(node.parentElement?.closest('input,textarea,select,script,style,[contenteditable=true]'))continue;
    const formatted=node.nodeValue.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,formatChartTimestamp);
    if(formatted!==node.nodeValue)node.nodeValue=formatted;
   }
   for(const history of root.querySelectorAll('.nativeHistory')){const form=history.parentElement.querySelector(':scope > form');if(form&&history.previousElementSibling!==null)form.before(history);}
  };
  new MutationObserver(formatHistory).observe(document.getElementById('view'),{childList:true,subtree:true});formatHistory();
 };
})();
