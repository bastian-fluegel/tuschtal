import { INK, PAPER } from './config.js';

/* ---------- SHADER: Tusche + Aquarell + Tag/Nacht ---------- */
export const NOISE = `
float h3(vec3 p){p=fract(p*.3183099+vec3(.71,.113,.419));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1.,0.,0.)),f.x),mix(h3(i+vec3(0.,1.,0.)),h3(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(h3(i+vec3(0.,0.,1.)),h3(i+vec3(1.,0.,1.)),f.x),mix(h3(i+vec3(0.,1.,1.)),h3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float fbm(vec3 p){return .55*vn(p)+.3*vn(p*2.03)+.15*vn(p*4.07);}
`;
export const VS = `
varying vec3 vW;varying vec3 vN;varying vec3 vC;
#ifdef VC
attribute vec3 aCol;
#endif
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);
#ifdef VC
vC=aCol;
#else
vC=vec3(1.);
#endif
gl_Position=projectionMatrix*viewMatrix*w;}`;
export const FS = `
uniform vec3 uColor,uL,uPaper,uInk,uTint;uniform float uFogNear,uFogFar,uTime,uDpr,uAlpha,uDay,uBlotch;uniform vec4 uLights[8];
varying vec3 vW;varying vec3 vN;varying vec3 vC;
${NOISE}
void main(){
vec3 n=normalize(vN);vec3 base=uColor*vC;
#ifdef WATER
n=vec3(0.,1.,0.);float r=vn(vec3(vW.xz*.3,uTime*.2));float r2=vn(vec3(vW.xz*1.1+7.,uTime*.35));
base=mix(vec3(.34,.53,.68),vec3(.52,.69,.8),r);
#endif
float pk=1.;float dcam=length(cameraPosition-vW);
#ifdef TERRAIN
pk=.45;
#endif
#ifndef WATER
float gr=dot(base,vec3(.333));base=clamp(mix(vec3(gr),base,1.3),0.,1.);
float fs=1.;
#ifdef TERRAIN
fs=1.;
#endif
float bk=pk*uBlotch*smoothstep(.36,.55,dot(vC,vec3(.3,.59,.11)));
vec3 q=vW*.5*fs+fbm(vW*.9)*.6;
float p1=vn(q+11.),p2=vn(q*1.2+37.),p3=vn(q*.9+71.);
base=mix(base,base*.35+vec3(.38,.58,.92)*.65,smoothstep(.52,.58,p1)*.7*bk);
base=mix(base,base*.35+vec3(.93,.42,.36)*.65,smoothstep(.56,.62,p2)*.6*bk);
base=mix(base,base*.4+vec3(.98,.74,.3)*.6,smoothstep(.5,.56,p3)*.6*bk);
#endif
float d=dot(n,uL)*.5+.5;
float nb=fbm(vW*.22);
float t=mix(d,floor(d*3.+nb*.7)/3.,.55);
float g=vn(vW*2.3+3.);
vec3 col=base*(.9+.22*nb)*(.94+.1*g);
vec3 shc=col*mix(col,vec3(.5,.6,.92),.45)*1.25;
col=mix(shc,col,clamp(t*1.3-.1,0.,1.));
vec3 vd=normalize(cameraPosition-vW);
col*=1.-.2*pow(1.-abs(dot(n,vd)),3.);
#ifndef WATER
float pm=smoothstep(.7,.76,d*.35+fbm(vW*.4+5.)*.8-.05);
col=mix(col,vec3(.96,.93,.86),pm*(pk<1.?.4:.7));
#endif
#ifdef VC
#ifndef TERRAIN
float isP=1.-smoothstep(.03,.09,distance(vC,vec3(.918,.859,.753)));
vec2 bc=vec2((vW.x+vW.z)*1.4,vW.y*2.6);vec2 bi=floor(bc),bf=fract(bc);
float mk=step(.78,h3(vec3(bi,1.)))*step(bf.y,.07)*step(.15,bf.x)*step(bf.x,.75);
mk+=step(.88,h3(vec3(bi,2.)))*step(bf.x,.05)*step(.1,bf.y)*step(bf.y,.6);
col=mix(col,uInk,clamp(mk,0.,1.)*isP*(1.-abs(n.y))*.7*(1.-smoothstep(12.,30.,dcam)));
#endif
#endif
vec2 fc=gl_FragCoord.xy/uDpr;
float hl=abs(fract((fc.x+fc.y)*.16)-.5);
col=mix(col,uInk,(1.-smoothstep(.06,.11,hl))*smoothstep(.28,.14,t)*.1);
#ifdef TERRAIN
vec2 tc=vW.xz*1.3;vec2 ti=floor(tc),tf=fract(tc);float th=h3(vec3(ti,5.));
float grass=step(vC.r*1.05,vC.g)*step(.85,n.y)*step(.5,vW.y)*(1.-smoothstep(20.,50.,dcam));
float dab=(1.-smoothstep(.1,.13,length(tf-.5)))*step(.9,th)*grass*smoothstep(2.,5.,dcam);
vec3 dc=th>.93?vec3(.98,.72,.28):th>.87?vec3(.36,.55,.24):vec3(.82,.45,.3);
col=mix(col,dc*mix(1.,.9,g),dab*.75);
float tk=step(.9,h3(vec3(ti,9.)))*grass*step(abs(tf.y-.5),.018)*step(abs(tf.x-.5),.11);
col=mix(col,uInk,tk*.4*smoothstep(3.,6.,dcam)*(1.-smoothstep(12.,25.,dcam)));
#endif
#ifdef TERRAIN
float hy=vW.y/2.;float cd=abs(fract(hy)-.5);float fw=fwidth(hy);
float cl=(1.-smoothstep(fw*.5,fw*1.3,.5-cd))*step(.3,vW.y);
col=mix(col,uInk,cl*.18);
#endif
col*=uTint;
vec3 lw=vec3(0.);
for(int i=0;i<8;i++){vec4 L=uLights[i];float dd=length(vW-L.xyz);float k=max(0.,1.-dd/8.);lw+=vec3(1.,.62,.28)*L.w*k*k;}
col+=lw*(.3+.7*base)*(1.-uDay*.75);
#ifdef WATER
float wl=1.-smoothstep(.03,.09,abs(fract(r*5.+r2*.7)-.5));
col=mix(col,uPaper,wl*.6);
#endif
float dist=length(cameraPosition-vW);
float f=smoothstep(uFogNear,uFogFar,dist+(nb-.5)*30.);
col=mix(col,uPaper,f);
gl_FragColor=vec4(col,uAlpha);}`;
export const HVS = `uniform float uW;varying vec3 vW;
${NOISE}
void main(){vec3 p=position+normal*uW*(.5+vn(position*4.));vec4 w=modelMatrix*vec4(p,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
export const HFS = `uniform vec3 uInk,uPaper;uniform float uFogNear,uFogFar;varying vec3 vW;
${NOISE}
void main(){if(vn(vW*1.7)>.72)discard;float f=smoothstep(uFogNear*.8,uFogFar,length(cameraPosition-vW));gl_FragColor=vec4(mix(uInk,uPaper,f),1.);}`;
export const SVS = `varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
export const SFS = `uniform vec3 uPaper,uInk,uSun;uniform float uTime,uDay,uDusk;varying vec3 vW;
${NOISE}
void main(){vec3 dir=normalize(vW-cameraPosition);float y=dir.y;
float wash=smoothstep(-.05,.55,y);float bl=fbm(dir*3.5+vec3(uTime*.01,0.,0.));
vec3 skyc=mix(vec3(.16,.2,.4),vec3(.5,.65,.82),uDay);
vec3 col=mix(uPaper,skyc,clamp(wash*(.3+.55*bl)+(1.-uDay)*.35*wash,0.,1.));
float cl=smoothstep(.5,.68,fbm(vec3(dir.x*2.5+uTime*.004,dir.y*7.,dir.z*2.5)));
col=mix(col,uPaper*1.04,cl*smoothstep(.02,.25,y)*(.35+.65*uDay));
vec2 hs=normalize(uSun.xz+vec2(.0001));float sd=max(dot(normalize(dir.xz+vec2(.0001)),hs),0.);
col=mix(col,vec3(.95,.6,.42),(1.-smoothstep(0.,.35,abs(y)))*sd*sd*uDusk*.6);
float st=step(.9965,h3(floor(dir*220.)))*(1.-uDay)*smoothstep(0.,.2,y);
col=mix(col,vec3(.98,.95,.85),st);
float s=dot(dir,uSun);col=mix(col,vec3(.98,.84,.55),smoothstep(.975,.988,s)*.85);
col=mix(col,uInk,(1.-smoothstep(0.,.0025,abs(s-.988)))*.6);
float m=dot(dir,-uSun);col=mix(col,vec3(.93,.92,.86),smoothstep(.986,.992,m));
col=mix(col,uInk,(1.-smoothstep(0.,.002,abs(m-.992)))*.5);
gl_FragColor=vec4(col,1.);}`;

export const U = {
  uL: { value: new THREE.Vector3(.6, .55, .35).normalize() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
  uPaper: { value: PAPER.clone() }, uInk: { value: INK }, uTint: { value: new THREE.Color(1, 1, 1) },
  uFogNear: { value: 42 }, uFogFar: { value: 92 }, uTime: { value: 0 }, uDpr: { value: 1 }, uDay: { value: 1 }, uDusk: { value: 0 },
  uLights: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }
};
export function wmat(defines, alpha = 1, color = '#ffffff', blotch = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uBlotch: { value: blotch } },
    vertexShader: VS, fragmentShader: FS, defines, transparent: alpha < 1, depthWrite: alpha >= 1, extensions: { derivatives: true }
  });
}
export const MAT = {
  terrain: wmat({ VC: 1, TERRAIN: 1 }), vc: wmat({ VC: 1 }), animal: wmat({ VC: 1 }, 1, '#ffffff', .2), ghost: wmat({ VC: 1 }, .5),
  erase: wmat({ VC: 1 }, .6, '#ff7a66'), water: wmat({ WATER: 1 }, .82),
  hull: new THREE.ShaderMaterial({ uniforms: { ...U, uW: { value: .034 } }, vertexShader: HVS, fragmentShader: HFS, side: THREE.BackSide }),
  sky: new THREE.ShaderMaterial({ uniforms: U, vertexShader: SVS, fragmentShader: SFS, side: THREE.BackSide, depthWrite: false, depthTest: false })
};

