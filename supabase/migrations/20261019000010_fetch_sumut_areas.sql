-- Step 1 of the North Sumatra boundary import: pg_net downloads geoBoundaries IDN ADM2 (simplified release,
-- BPS / WFP / OCHA ROAP, CC BY 3.0 IGO) after this transaction commits. Step 2 (next migration) reads the response.
select net.http_get(
  url := 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson',
  timeout_milliseconds := 60000);
