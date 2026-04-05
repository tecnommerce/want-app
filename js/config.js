// ===================================================
// CONFIGURACIÓN DE WANT - VERSIÓN SUPABASE
// ===================================================

// ===================================================
// SUPABASE CONFIGURACIÓN
// ===================================================

// ⚠️ IMPORTANTE: Reemplaza estos valores con los de tu proyecto Supabase ⚠️
// Puedes encontrarlos en: Project Settings → API

const SUPABASE_URL = 'https://owrpzmgncfrgatzccjlc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93cnB6bWduY2ZyZ2F0emNjamxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzNjIxNTIsImV4cCI6MjA5MDkzODE1Mn0.TOFcl0_Ua3jpISBKnrNdI4skIFMiyitWv0rLDoTzTkQ';

// ===================================================
// CLOUDINARY CONFIGURACIÓN (NO CAMBIA)
// ===================================================

const CLOUDINARY_CLOUD_NAME = 'dlsmvyz8r';
const CLOUDINARY_UPLOAD_PRESET = 'want_productos';

// ===================================================
// EXPORTAR CONFIGURACIÓN GLOBAL
// ===================================================

window.WANT_CONFIG = {
    // Supabase
    supabaseUrl: SUPABASE_URL,
    supabaseAnonKey: SUPABASE_ANON_KEY,
    
    // Cloudinary
    cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
    cloudinaryUploadPreset: CLOUDINARY_UPLOAD_PRESET,
    
    // Google Apps Script (ya no se usa, se mantiene por compatibilidad)
    apiUrl: '',
    
    // Modo de funcionamiento
    useSupabase: true,  // true = usar Supabase, false = usar Google Sheets
};

console.log('✅ Configuración cargada (modo Supabase)');