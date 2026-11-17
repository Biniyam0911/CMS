function Ds({
  paused:e=!1,active:t=!0
}
){
  let n=(0,S.useRef)(null),r=(0,S.useRef)(null),i=(0,S.useRef)(e||!t);
  return(0,S.useEffect)(()=>{
    i.current=e||!t
  }
  ,[e,t]),(0,S.useEffect)(()=>{
    let e=n.current,t=r.current;
    if(!e||!t)return;
    let a=t.getContext(`2d`,{
      alpha:!0
    }
    );
    if(!a)return;
    let o=document.createElement(`canvas`);
    o.width=1024,o.height=1024;
    let s=o.getContext(`2d`),c=!1,l=0,u=0,d=0,f=0,p=0,m=!0,h=!0,g=[],_=new Image;
    _.src=F(`female-hologram.webp`);
    let v=()=>{
      f=e.clientWidth,p=e.clientHeight;
      let n=Math.min(devicePixelRatio,1.6);
      t.width=Math.round(f*n),t.height=Math.round(p*n),a.setTransform(n,0,0,n,0,0),h=!0
    }
    ,y=new ResizeObserver(v);
    y.observe(e),v();
    let b=new IntersectionObserver(([e])=>{
      m=e.isIntersecting,h=!0
    }
    );
    b.observe(e),_.onload=()=>{
      if(c)return;
      if(s){
        s.drawImage(_,0,0,1024,1024),s.globalCompositeOperation=`destination-in`;
        let e=s.createRadialGradient(512,480,230,512,480,530);
        e.addColorStop(0,`#000`),e.addColorStop(.6,`#000c`),e.addColorStop(1,`#0000`),s.fillStyle=e,s.fillRect(0,0,1024,1024)
      }
      let t=document.createElement(`canvas`);
      t.width=384,t.height=384;
      let n=t.getContext(`2d`);
      if(!n)return;
      n.drawImage(_,0,0,384,384);
      let r=n.getImageData(0,0,384,384).data;
      for(let e=4;
      e<380;
      e+=3)for(let t=4;
      t<380;
      t+=3){
        let n=(e*384+t)*4,i=r[n],a=r[n+1],o=r[n+2];
        if(a<64||Math.max(i,a,o)<86)continue;
        let s=(i+a+o)/765;
        g.push({
          x:t/384-.5,y:e/384-.5,z:s*.08,seed:t*.013+e*.021,bucket:i>o*.85?3:s>.68?2:+(s>.43)
        }
        )
      }
      e.dataset.ready=`true`,h=!0
    }
    ;
    let x=e=>{
      if(l=requestAnimationFrame(x),e-u<32)return;
      let t=Math.min((e-u)/1e3,.08);
      if(u=e,!m||document.hidden||!_.complete||!_.naturalWidth||!f||!p||(i.current||(d+=t,h=!0),!h))return;
      h=!1;
      let n=Math.min(f*1.12,p*1.12),r=f*.5,c=p*.51,v=d%5.4/5.4,y=Math.max(0,Math.sin((v-.2)*Math.PI*2))**3,b=Math.sin(d*.86)*.045,ee=1.02+Math.sin(d*1.16)*.025;
      a.clearRect(0,0,f,p),a.save(),a.translate(r+Math.sin(d*.8)*n*.008,c),a.scale(ee*(1-Math.abs(b)*.5),ee),a.rotate(Math.sin(d*.6)*.012),a.globalAlpha=1-y*.78,a.drawImage(s?o:_,-n/2,-n/2,n,n),a.globalAlpha=1;
      let S=(v*1.6-.3)*n-n*.5;
      a.globalCompositeOperation=`screen`,a.save(),a.beginPath(),a.rect(-n*.5,S-n*.045,n,n*.09),a.clip(),a.globalAlpha=.25*(1-y*.5),a.filter=`sepia(.6) brightness(1.5)`,a.drawImage(s?o:_,-n/2,-n/2,n,n),a.filter=`none`,a.restore();
      let C=[`#397e94`,`#69c7d7`,`#c5f4f5`,`#e8c987`];
      for(let e=0;
      e<4;
      e++){
        a.fillStyle=C[e],a.globalAlpha=.15+y*.8,a.beginPath();
        for(let t of g){
          if(t.bucket!==e)continue;
          let r=d*2.2+t.seed,i=y*(.011+t.z*.6),o=1+t.z*b*4,s=(t.x*o+Math.sin(r+t.y*9)*i+b*t.z)*n,c=(t.y+Math.cos(r*.8+t.x*11)*i*.64)*n,l=n/640*(e===3?1.25:.95)*(1+y*.22);
          a.rect(s,c,l,l)
        }
        a.fill()
      }
      a.globalAlpha=1,a.globalCompositeOperation=`source-over`,a.restore()
    }
    ;
    return l=requestAnimationFrame(x),()=>{
      c=!0,cancelAnimationFrame(l),y.disconnect(),b.disconnect(),_.onload=null
    }
    
  }
  ,[]),(0,R.jsxs)(`div`,{
    ref:n,className:`female-hologram`,"aria-hidden":`true`,children:[(0,R.jsx)(`img`,{
      src:F(`female-hologram.webp`),alt:``,fetchPriority:`high`
    }
    ),(0,R.jsx)(`canvas`,{
      ref:r
    }
    )]
  }
  )
}
