import { useState } from 'react';
const STAGES=['jiaguwen','jinwen','xiaozhuan','lishu','kaishu','simplified'];
const SL={jiaguwen:{zh:'甲骨文',en:'Oracle Bone',year:'c.1250 BCE'},jinwen:{zh:'金文',en:'Bronze',year:'c.1050 BCE'},xiaozhuan:{zh:'小篆',en:'Seal',year:'221 BCE'},lishu:{zh:'隶书',en:'Clerical',year:'206 BCE'},kaishu:{zh:'楷书',en:'Standard',year:'618 CE'},simplified:{zh:'简体',en:'Simplified',year:'1956'}};
function scaleVB(svg,w,h){if(!svg)return '';return svg.replace('viewBox="0 0 100 100"',`width="${w}" height="${h}" viewBox="0 0 100 100"`).replace('viewBox="0 0 120 100"',`width="${w}" height="${Math.round(h*100/120)}" viewBox="0 0 120 100"`).replace('viewBox="0 0 100 120"',`width="${Math.round(w*100/120)}" height="${h}" viewBox="0 0 100 120"`);}
export default function JiaguWenPanel({character,lang='en'}){
  const [open,setOpen]=useState(false);
  if(!character)return null;
  const sem=typeof character.semantics==='string'?JSON.parse(character.semantics||'{}'):(character.semantics||{});
  const evo=typeof character.evolution==='string'?JSON.parse(character.evolution||'{}'):(character.evolution||{});
  const divTopics=sem.divination_topics||[];
  const shangCtx=sem.shang_context||'';
  const hasMnemonic=!!character.mnemonic_svg;
  const mnStory=lang==='zh'?character.mnemonic_story_zh:lang==='it'?character.mnemonic_story_it:character.mnemonic_story_en;
  return (
    <div style={{width:'100%',maxWidth:320,margin:'0 auto'}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:'100%',padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:open?'12px 12px 0 0':'12px',cursor:'pointer',fontFamily:'var(--font-sans)'}}>
        <span style={{fontSize:13,fontWeight:500,color:'var(--color-text-primary)'}}>甲骨文介绍 · Oracle Bone Origin</span>
        <span style={{fontSize:16,color:'var(--color-text-tertiary)',transform:open?'rotate(180deg)':'none',transition:'transform 0.2s'}}>▾</span>
      </button>
      {open&&(
        <div style={{border:'0.5px solid var(--color-border-tertiary)',borderTop:'none',borderRadius:'0 0 12px 12px',background:'var(--color-background-primary)',padding:'14px'}}>
          <div style={{display:'flex',gap:12,marginBottom:14}}>
            {character.svg_jiaguwen&&(
              <div>
                <div style={{fontSize:10,color:'var(--color-text-tertiary)',marginBottom:4,textAlign:'center'}}>甲骨文</div>
                <div style={{width:78,height:78,background:'#fdf6e3',border:'1px solid #c89090',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} dangerouslySetInnerHTML={{__html:scaleVB(character.svg_jiaguwen,66,66)}}/>
              </div>
            )}
            {character.svg_jiaguwen&&hasMnemonic&&<div style={{display:'flex',alignItems:'center',color:'var(--color-text-tertiary)',fontSize:18,alignSelf:'center',marginTop:16}}>→</div>}
            {hasMnemonic&&(
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:'var(--color-text-tertiary)',marginBottom:4,textAlign:'center'}}>图解 Illustration</div>
                <div style={{width:'100%',minHeight:78,background:'linear-gradient(135deg,#e8f4e8,#d4eaf7)',border:'0.5px solid var(--color-border-secondary)',borderRadius:10,overflow:'hidden'}} dangerouslySetInnerHTML={{__html:character.mnemonic_svg.replace('<svg ','<svg width="100%" height="78" ')}}/>
              </div>
            )}
            {!hasMnemonic&&character.svg_jiaguwen&&(
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center'}}>
                {character.mnemonic_en&&<div style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.5,fontStyle:'italic'}}>{character.mnemonic_en}</div>}
                {divTopics.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}}>{divTopics.slice(0,2).map(t=><span key={t} style={{fontSize:10,padding:'2px 6px',borderRadius:20,background:'var(--color-background-warning)',color:'var(--color-text-warning)'}}>{t.replace(/_/g,' ')}</span>)}</div>}
              </div>
            )}
          </div>
          {(mnStory||character.mnemonic_story_en)&&<div style={{background:'var(--color-background-secondary)',borderLeft:'3px solid #8B4513',borderRadius:'0 8px 8px 0',padding:'8px 12px',fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.65,marginBottom:12,fontStyle:'italic'}}>{mnStory||character.mnemonic_story_en}</div>}
          {shangCtx&&<div style={{background:'var(--color-background-secondary)',borderLeft:'3px solid #c89090',borderRadius:'0 8px 8px 0',padding:'8px 12px',fontSize:11,color:'var(--color-text-secondary)',lineHeight:1.65,marginBottom:14}}>{shangCtx}</div>}
          {Object.keys(evo).length>0&&(
            <>
              <div style={{fontSize:11,color:'var(--color-text-tertiary)',marginBottom:6,letterSpacing:'0.05em'}}>3000年演变 · Evolution</div>
              <div style={{display:'flex',gap:4,overflowX:'auto',paddingBottom:4}}>
                {STAGES.filter(s=>evo[s]).map((stage,i,arr)=>{
                  const info=SL[stage];
                  return(
                    <div key={stage} style={{display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
                      <div style={{background:stage==='jiaguwen'?'#8B4513':'var(--color-background-secondary)',border:`0.5px solid ${stage==='jiaguwen'?'#8B4513':'var(--color-border-secondary)'}`,borderRadius:8,padding:'5px 7px',textAlign:'center',minWidth:50}}>
                        <div style={{fontSize:16,fontFamily:"'STKaiti','KaiTi',serif",color:stage==='jiaguwen'?'#fdf6e3':'var(--color-text-primary)',lineHeight:1}}>{character.glyph_modern}</div>
                        <div style={{fontSize:9,color:stage==='jiaguwen'?'rgba(253,246,227,0.7)':'var(--color-text-tertiary)',marginTop:2}}>{info.zh}</div>
                        <div style={{fontSize:8,color:stage==='jiaguwen'?'rgba(253,246,227,0.5)':'var(--color-text-tertiary)'}}>{info.year}</div>
                      </div>
                      {i<arr.length-1&&<div style={{fontSize:11,color:'var(--color-text-tertiary)',flexShrink:0}}>→</div>}
                    </div>
                  );
                })}
              </div>
              {evo.change_summary&&<div style={{marginTop:8,fontSize:10,color:'var(--color-text-tertiary)',lineHeight:1.5,fontStyle:'italic'}}>{evo.change_summary}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
