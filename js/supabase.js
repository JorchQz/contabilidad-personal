// js/supabase.js — Configuración del cliente Supabase con Auth

const SUPABASE_URL = 'https://rzanhkfmwvbngbpjefec.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6YW5oa2Ztd3ZibmdicGplZmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzA4OTIsImV4cCI6MjA5MTY0Njg5Mn0.jNLOGysqa0vpCvwXZ6JWw5byhVQ6cSCMHeWD_9nc3pk';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getUsuarioId() {
  const { data } = await db.auth.getUser();
  return data?.user?.id || null;
}
