import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlexEpisode,planEpisodeInventoryDiff} from '../lib/series-plex-episode-diff.mjs';

const old=(overrides={})=>({
  rating_key:'e1',library_section_id:7,plex_title:'Uno',plex_year:2026,plex_updated_at:'2026-09-10T10:00:00.000Z',parent_rating_key:'s1',grandparent_rating_key:'show1',parent_index:1,item_index:1,fingerprint:'old',active:true,...overrides
});
const fresh=(overrides={})=>({
  rating_key:'e1',library_section_id:7,plex_title:'Uno',plex_year:2026,plex_updated_at:'2026-09-10T10:00:00.000Z',parent_rating_key:'s1',grandparent_rating_key:'show1',parent_index:1,item_index:1,fingerprint:'new',...overrides
});

test('normaliza el inventario ligero de Plex sin media física',()=>{
  const row=normalizePlexEpisode({ratingKey:123,type:'episode',title:'Piloto',year:2026,updatedAt:1789005600,parentRatingKey:55,grandparentRatingKey:44,parentIndex:2,index:3,librarySectionID:7},{sectionId:9,fingerprint:'fp'});
  assert.equal(row.rating_key,'123');assert.equal(row.grandparent_rating_key,'44');assert.equal(row.parent_index,2);assert.equal(row.item_index,3);assert.equal(row.library_section_id,7);assert.equal(row.fingerprint,'fp');
});

test('inventario idéntico produce cero escrituras',()=>{
  const diff=planEpisodeInventoryDiff({incoming:[fresh()],existing:[old()],successfulSectionIds:[7]});
  assert.equal(diff.created.length,0);assert.equal(diff.changed.length,0);assert.equal(diff.missing.length,0);assert.equal(diff.upserts.length,0);assert.deepEqual(diff.affectedShowKeys,[]);
});

test('detecta capítulo nuevo y sólo afecta a su serie',()=>{
  const row=fresh({rating_key:'e2',item_index:2});
  const diff=planEpisodeInventoryDiff({incoming:[fresh(),row],existing:[old()],successfulSectionIds:[7]});
  assert.deepEqual(diff.created.map(x=>x.rating_key),['e2']);assert.deepEqual(diff.affectedShowKeys,['show1']);
});

test('detecta correcciones de título, numeración y reactivación',()=>{
  const corrected=planEpisodeInventoryDiff({incoming:[fresh({plex_title:'Uno corregido',item_index:2})],existing:[old()],successfulSectionIds:[7]});
  assert.equal(corrected.changed.length,1);
  const reactivated=planEpisodeInventoryDiff({incoming:[fresh()],existing:[old({active:false})],successfulSectionIds:[7]});
  assert.equal(reactivated.changed.length,1);
});

test('detecta bajas sólo dentro de bibliotecas cuyo inventario terminó bien',()=>{
  const existing=[old(),old({rating_key:'e2',library_section_id:8,grandparent_rating_key:'show2'})];
  const diff=planEpisodeInventoryDiff({incoming:[],existing,successfulSectionIds:[7]});
  assert.deepEqual(diff.missing.map(x=>x.rating_key),['e1']);assert.deepEqual(diff.affectedShowKeys,['show1']);
});

test('un episodio movido de biblioteca no se trata como baja si sigue presente',()=>{
  const moved=fresh({library_section_id:8});
  const diff=planEpisodeInventoryDiff({incoming:[moved],existing:[old()],successfulSectionIds:[7,8]});
  assert.equal(diff.changed.length,1);assert.equal(diff.missing.length,0);
});
