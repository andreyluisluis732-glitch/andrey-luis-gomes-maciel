import { createClient } from '@supabase/supabase-js';

// Usando as credenciais fornecidas diretamente para esta integração específica
const supabaseUrl = 'https://llfzxajznfzvmqiehvgq.supabase.co';
const supabaseAnonKey = 'sb_publishable_zM0kWP6Xa5vmrt6oI52HiQ_fCCT0Krv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
