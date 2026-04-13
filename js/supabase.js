// js/supabase.js — Configuración del cliente Supabase
// ⚠️ Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY con los valores de tu proyecto

const SUPABASE_URL = 'https://rzanhkfmwvbngbpjefec.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6YW5oa2Ztd3ZibmdicGplZmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzA4OTIsImV4cCI6MjA5MTY0Njg5Mn0.jNLOGysqa0vpCvwXZ6JWw5byhVQ6cSCMHeWD_9nc3pk'; // Settings → API → anon public

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ID del usuario activo (single-user por ahora, multi-user en el futuro)
let USUARIO_ID = localStorage.getItem('jmf_usuario_id') || null;

function setUsuarioId(id) {
  USUARIO_ID = id;
  localStorage.setItem('jmf_usuario_id', id);
}

function getUsuarioId() {
  return USUARIO_ID;
}
