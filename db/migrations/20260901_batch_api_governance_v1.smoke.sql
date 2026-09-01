DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM batch_api_source_limits WHERE source='tmdb' AND daily_limit IS NULL AND batch_share_percent=90) THEN RAISE EXCEPTION 'TMDb seed inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM batch_api_source_limits WHERE source='omdb' AND daily_limit=100000 AND batch_share_percent=90) THEN RAISE EXCEPTION 'OMDb seed inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM batch_api_source_limits WHERE source='mdblist' AND daily_limit=25000 AND batch_share_percent=90) THEN RAISE EXCEPTION 'MDBList seed inválido'; END IF;
 PERFORM * FROM batch_api_acquire_source('tmdb','batch','smoke',5);
 DELETE FROM batch_api_source_leases WHERE owner='smoke';
END $$;
