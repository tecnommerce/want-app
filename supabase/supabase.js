// ===================================================
// SUPABASE - Configuración y cliente
// ===================================================

// ⚠️ REEMPLAZA ESTOS VALORES CON LOS TUYOS ⚠️
const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM2MjE1MiwiZXhwIjoyMDkwOTM4MTUyfQ.oezxPXhfbVpJp05n2SS6Y0X9Ukr-aW8k9m6jFncVrxo';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase inicializado');