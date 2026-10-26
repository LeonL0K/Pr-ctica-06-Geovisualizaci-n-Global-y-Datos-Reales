<?php
// api/index.php - Proxy con caché en archivo JSON (Sin MySQL)
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

// Ruta del archivo donde guardaremos el caché
$archivoCache = __DIR__ . '/cache.json';

// Función para llamar a APIs con caché en archivo
function obtenerDatos($apiNombre, $url, $horasCache = 24) {
    global $archivoCache;
    $key = md5($url); // Creamos una clave única basada en la URL

    // 1. Leer el caché existente
    $cacheData = file_exists($archivoCache) ? json_decode(file_get_contents($archivoCache), true) : [];
    
    // 2. Revisar si ya existe y no ha expirado
    if (isset($cacheData[$key]) && $cacheData[$key]['expira'] > time()) {
        return $cacheData[$key]['data'];
    }

    // 3. Si no hay caché, llamar a la API externa con cURL
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Para XAMPP local
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['error' => "Fallo en API ($apiNombre). Código HTTP: $httpCode"];
    }

    $data = json_decode($response, true);

    // 4. Guardar en el archivo de caché
    $cacheData[$key] = [
        'data' => $data,
        'expira' => time() + ($horasCache * 3600)
    ];
    file_put_contents($archivoCache, json_encode($cacheData));

    return $data;
}

// Enrutador
$accion = $_GET['accion'] ?? '';
$lat = $_GET['lat'] ?? null;
$lon = $_GET['lon'] ?? null;

if (!$lat || !$lon) {
    echo json_encode(['error' => 'Faltan parámetros lat y lon']);
    exit;
}

if ($accion === 'clima') {
    // NASA POWER (últimos 7 días)
    $fin = date('Ymd');
    $inicio = date('Ymd', strtotime('-7 days'));
    $urlNasa = "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=AG&longitude=$lon&latitude=$lat&start=$inicio&end=$fin&format=JSON";
    
    $data = obtenerDatos('nasa', $urlNasa, 24);
    echo json_encode(['status' => 'ok', 'resultado' => ['data' => $data]]);

} elseif ($accion === 'gbif') {
    // GBIF (Biodiversidad)
    $urlGbif = "https://api.gbif.org/v1/occurrence/search?decimalLatitude=$lat&decimalLongitude=$lon&radius=50&limit=10";
    
    $data = obtenerDatos('gbif', $urlGbif, 168); // Caché de 1 semana
    echo json_encode(['status' => 'ok', 'resultado' => ['data' => $data]]);

} else {
    echo json_encode(['error' => 'Acción no válida']);
}