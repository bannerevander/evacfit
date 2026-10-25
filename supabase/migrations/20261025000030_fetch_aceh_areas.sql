-- Step 1 of importing Aceh areas (Aceh Tamiang, Kota Banda Aceh): same geoBoundaries IDN ADM2 file as migrations 10 and 24.
select net.http_get(
  url := 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09592ced973a3448cf66b6100b741b64c0d/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2_simplified.geojson',
  timeout_milliseconds := 60000);
