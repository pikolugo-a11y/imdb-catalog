import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProbeFingerprint,buildTechnicalFingerprint,normalizeTechnicalSnapshot,selectPrimaryAudioStream} from '../lib/plex-technical-core.mjs';

const item={ratingKey:'123',updatedAt:1700000000,Media:[{id:'m1',duration:7200000,bitrate:12000,width:3840,height:2160,container:'mkv',videoCodec:'hevc',videoProfile:'main 10',videoFrameRate:'24p',videoDynamicRange:'HDR',audioCodec:'truehd',audioChannels:8,Part:[{id:'p1',file:'/movies/Test.mkv',size:12000000000,duration:7200000,container:'mkv',Stream:[{streamType:1,codec:'hevc',profile:'main 10',bitrate:10000,bitDepth:10,dynamicRange:'HDR10',colorSpace:'bt2020',width:3840,height:2160,frameRate:'23.976'},{streamType:2,codec:'ac3',bitrate:640,channels:6,selected:0,default:0,language:'Español'},{streamType:2,codec:'truehd',bitrate:3000,channels:8,selected:1,default:1,language:'Español'}]}]}]};

test('normaliza media, file y streams sin depender de resolution',()=>{
  const s=normalizeTechnicalSnapshot(item);
  assert.equal(s.rating_key,'123');
  assert.equal(s.medias[0].width,3840);
  assert.equal(s.medias[0].parts[0].file_path,'Test.mkv');
  assert.equal(s.medias[0].parts[0].streams[0].bit_depth,10);
});

test('audio principal prioriza selected y luego default',()=>{
  const streams=normalizeTechnicalSnapshot(item).medias[0].parts[0].streams;
  assert.equal(selectPrimaryAudioStream(streams)?.codec,'truehd');
  assert.equal(selectPrimaryAudioStream([{stream_type:2,codec:'aac',is_default:false},{stream_type:2,codec:'ac3',is_default:true}])?.codec,'ac3');
});

test('probe fingerprint cambia con el archivo pero technical fingerprint depende del snapshot',()=>{
  const p1=buildProbeFingerprint(item);
  const p2=buildProbeFingerprint({...item,updatedAt:1700000010});
  assert.notEqual(p1,p2);
  const snap=normalizeTechnicalSnapshot(item);
  assert.equal(buildTechnicalFingerprint(snap),buildTechnicalFingerprint(structuredClone(snap)));
});
