import test from 'node:test';
import assert from 'node:assert/strict';
import {buildManualDoubleCoverage,matchPlexBySeasonEpisode} from '../lib/series-diagnostics-core.mjs';

const plexRow=(season,episode,ratingKey,title,overrides={})=>({
  rating_key:String(ratingKey),season_number:season,episode_number:episode,plex_title:title,
  actual_duration_minutes:22,fingerprint:`fp-${ratingKey}`,...overrides
});

test('prioriza temporada y número aunque el título coincida con otro episodio oficial',()=>{
  const plex=[
    plexRow(7,18,100149,'Adiós, muñeca'),
    plexRow(7,19,100150,'Hasta que la muerte nos separe')
  ];
  const ref18={season_number:7,episode_number:18,name:'Elegid o perded'};
  const ref19={season_number:7,episode_number:19,name:'Adiós, muñeca'};
  assert.equal(matchPlexBySeasonEpisode({ref:ref18,plex})?.rating_key,'100149');
  assert.equal(matchPlexBySeasonEpisode({ref:ref19,plex})?.rating_key,'100150');
});

test('una decisión manual de capítulo doble sobrevive a cambios de fingerprint',()=>{
  const plex=[plexRow(5,25,100177,"I'm a Good Girl, I Am",{fingerprint:'fingerprint-nuevo'})];
  const manualOverrides=[{
    season_number:5,
    episode_number:26,
    note:JSON.stringify({
      manual_double:1,
      plex_rating_key:'100177',
      plex_fingerprint:'fingerprint-antiguo',
      source_season:5,
      source_episode:25,
      target_season:5,
      target_episode:26
    })
  }];
  const coverage=buildManualDoubleCoverage({manualOverrides,plex});
  assert.equal(coverage.get('5-26')?.p.rating_key,'100177');
  assert.equal(coverage.get('5-26')?.p.fingerprint,'fingerprint-nuevo');
});

test('una decisión manual usa el S/E actual aunque cambie el rating key del archivo Plex',()=>{
  const plex=[plexRow(5,25,999999,"I'm a Good Girl, I Am")];
  const manualOverrides=[{
    season_number:5,
    episode_number:26,
    note:JSON.stringify({
      manual_double:1,
      plex_rating_key:'100177',
      plex_fingerprint:'fingerprint-antiguo',
      source_season:5,
      source_episode:25,
      target_season:5,
      target_episode:26
    })
  }];
  const coverage=buildManualDoubleCoverage({manualOverrides,plex});
  assert.equal(coverage.get('5-26')?.p.rating_key,'999999');
});

test('no inventa cobertura manual si el episodio origen ya no existe en Plex',()=>{
  const manualOverrides=[{
    season_number:5,
    episode_number:26,
    note:JSON.stringify({manual_double:1,source_season:5,source_episode:25,target_season:5,target_episode:26})
  }];
  const coverage=buildManualDoubleCoverage({manualOverrides,plex:[]});
  assert.equal(coverage.size,0);
});

test('un episodio Plex ya usado no se reutiliza como coincidencia automática',()=>{
  const plex=[plexRow(7,18,100149,'Adiós, muñeca')];
  const used=new Set(['100149']);
  assert.equal(matchPlexBySeasonEpisode({ref:{season_number:7,episode_number:18},plex,used}),null);
});
