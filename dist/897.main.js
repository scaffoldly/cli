#!/usr/bin/env node
"use strict";exports.id=897,exports.ids=[897],exports.modules={47897:(e,t,a)=>{a.d(t,{ENV_CMDS_FULL_URI:()=>p,ENV_CMDS_RELATIVE_URI:()=>m,fromContainerMetadata:()=>f,fromInstanceMetadata:()=>P,getInstanceMetadataEndpoint:()=>T,httpRequest:()=>i});var n=a(18112),r=a(87016),o=a(20181),s=a(58611);function i(e){return new Promise(((t,a)=>{const r=(0,s.request)({method:"GET",...e,hostname:e.hostname?.replace(/^\[(.+)\]$/,"$1")});r.on("error",(e=>{a(Object.assign(new n.mZ("Unable to connect to instance metadata service"),e)),r.destroy()})),r.on("timeout",(()=>{a(new n.mZ("TimeoutError from instance metadata service")),r.destroy()})),r.on("response",(e=>{const{statusCode:s=400}=e;(s<200||300<=s)&&(a(Object.assign(new n.mZ("Error response received from instance metadata service"),{statusCode:s})),r.destroy());const i=[];e.on("data",(e=>{i.push(e)})),e.on("end",(()=>{t(o.Buffer.concat(i)),r.destroy()}))})),r.end()}))}const c=e=>Boolean(e)&&"object"==typeof e&&"string"==typeof e.AccessKeyId&&"string"==typeof e.SecretAccessKey&&"string"==typeof e.Token&&"string"==typeof e.Expiration,l=e=>({accessKeyId:e.AccessKeyId,secretAccessKey:e.SecretAccessKey,sessionToken:e.Token,expiration:new Date(e.Expiration)}),d=({maxRetries:e=0,timeout:t=1e3})=>({maxRetries:e,timeout:t}),u=(e,t)=>{let a=e();for(let n=0;n<t;n++)a=a.catch(e);return a},p="AWS_CONTAINER_CREDENTIALS_FULL_URI",m="AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",g="AWS_CONTAINER_AUTHORIZATION_TOKEN",f=(e={})=>{const{timeout:t,maxRetries:a}=d(e);return()=>u((async()=>{const a=await y({logger:e.logger}),r=JSON.parse(await h(t,a));if(!c(r))throw new n.C1("Invalid response received from instance metadata service.",{logger:e.logger});return l(r)}),a)},h=async(e,t)=>(process.env[g]&&(t.headers={...t.headers,Authorization:process.env[g]}),(await i({...t,timeout:e})).toString()),v={localhost:!0,"127.0.0.1":!0},w={"http:":!0,"https:":!0},y=async({logger:e})=>{if(process.env[m])return{hostname:"169.254.170.2",path:process.env[m]};if(process.env[p]){const t=(0,r.parse)(process.env[p]);if(!t.hostname||!(t.hostname in v))throw new n.C1(`${t.hostname} is not a valid container metadata service hostname`,{tryNextLink:!1,logger:e});if(!t.protocol||!(t.protocol in w))throw new n.C1(`${t.protocol} is not a valid container metadata service protocol`,{tryNextLink:!1,logger:e});return{...t,port:t.port?parseInt(t.port,10):void 0}}throw new n.C1(`The container metadata credential provider cannot be used unless the ${m} or ${p} environment variable is set`,{tryNextLink:!1,logger:e})};var E=a(39987);class I extends n.C1{constructor(e,t=!0){super(e,t),this.tryNextLink=t,this.name="InstanceMetadataV1FallbackError",Object.setPrototypeOf(this,I.prototype)}}var _,A=a(82641);!function(e){e.IPv4="http://169.254.169.254",e.IPv6="http://[fd00:ec2::254]"}(_||(_={}));const S={environmentVariableSelector:e=>e.AWS_EC2_METADATA_SERVICE_ENDPOINT,configFileSelector:e=>e.ec2_metadata_service_endpoint,default:void 0};var C;!function(e){e.IPv4="IPv4",e.IPv6="IPv6"}(C||(C={}));const b={environmentVariableSelector:e=>e.AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE,configFileSelector:e=>e.ec2_metadata_service_endpoint_mode,default:C.IPv4},T=async()=>(0,A.D)(await x()||await D()),x=async()=>(0,E.Z)(S)(),D=async()=>{const e=await(0,E.Z)(b)();switch(e){case C.IPv4:return _.IPv4;case C.IPv6:return _.IPv6;default:throw new Error(`Unsupported endpoint mode: ${e}. Select from ${Object.values(C)}`)}},N=(e,t)=>{const a=300+Math.floor(300*Math.random()),n=new Date(Date.now()+1e3*a);t.warn(`Attempting credential expiration extension due to a credential service availability issue. A refresh of these credentials will be attempted after ${new Date(n)}.\nFor more information, please visit: https://docs.aws.amazon.com/sdkref/latest/guide/feature-static-credentials.html`);const r=e.originalExpiration??e.expiration;return{...e,...r?{originalExpiration:r}:{},expiration:n}},k="/latest/meta-data/iam/security-credentials/",M="AWS_EC2_METADATA_V1_DISABLED",R="ec2_metadata_v1_disabled",O="x-aws-ec2-metadata-token",P=(e={})=>((e,t={})=>{const a=t?.logger||console;let n;return async()=>{let t;try{t=await e(),t.expiration&&t.expiration.getTime()<Date.now()&&(t=N(t,a))}catch(e){if(!n)throw e;a.warn("Credential renew failed: ",e),t=N(n,a)}return n=t,t}})(V(e),{logger:e.logger}),V=(e={})=>{let t=!1;const{logger:a,profile:r}=e,{timeout:o,maxRetries:s}=d(e),i=async(a,o)=>{if(t||null==o.headers?.[O]){let t=!1,a=!1;const o=await(0,E.Z)({environmentVariableSelector:t=>{const r=t[M];if(a=!!r&&"false"!==r,void 0===r)throw new n.C1(`${M} not set in env, checking config file next.`,{logger:e.logger});return a},configFileSelector:e=>{const a=e[R];return t=!!a&&"false"!==a,t},default:!1},{profile:r})();if(e.ec2MetadataV1Disabled||o){const n=[];throw e.ec2MetadataV1Disabled&&n.push("credential provider initialization (runtime option ec2MetadataV1Disabled)"),t&&n.push(`config file profile (${R})`),a&&n.push(`process environment variable (${M})`),new I(`AWS EC2 Metadata v1 fallback has been blocked by AWS SDK configuration in the following: [${n.join(", ")}].`)}}const s=(await u((async()=>{let e;try{e=await $(o)}catch(e){throw 401===e.statusCode&&(t=!1),e}return e}),a)).trim();return u((async()=>{let a;try{a=await K(s,o,e)}catch(e){throw 401===e.statusCode&&(t=!1),e}return a}),a)};return async()=>{const e=await T();if(t)return a?.debug("AWS SDK Instance Metadata","using v1 fallback (no token fetch)"),i(s,{...e,timeout:o});{let n;try{n=(await L({...e,timeout:o})).toString()}catch(n){if(400===n?.statusCode)throw Object.assign(n,{message:"EC2 Metadata token request returned error"});return("TimeoutError"===n.message||[403,404,405].includes(n.statusCode))&&(t=!0),a?.debug("AWS SDK Instance Metadata","using v1 fallback (initial)"),i(s,{...e,timeout:o})}return i(s,{...e,headers:{[O]:n},timeout:o})}}},L=async e=>i({...e,path:"/latest/api/token",method:"PUT",headers:{"x-aws-ec2-metadata-token-ttl-seconds":"21600"}}),$=async e=>(await i({...e,path:k})).toString(),K=async(e,t,a)=>{const r=JSON.parse((await i({...t,path:k+e})).toString());if(!c(r))throw new n.C1("Invalid response received from instance metadata service.",{logger:a.logger});return l(r)}}};
//# sourceMappingURL=897.main.js.map