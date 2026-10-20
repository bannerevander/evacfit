-- Step 1 of importing hazard-prone areas outside North Sumatra (same geoBoundaries IDN ADM2 file as migration 10).
select net.http_get(
  url := 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson',
  timeout_milliseconds := 60000);
