// ===================================================
// SUPABASE - Configuración y cliente
// ===================================================

// ⚠️ REEMPLAZA ESTOS VALORES CON LOS TUYOS ⚠️
const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjIxNTIsImV4cCI6MjA5MDkzODE1Mn0.TOFcl0_Ua3jpISBKnrNdI4skIFMiyitWv0rLDoTzTkQ';

// Inicializar Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ Supabase inicializado');