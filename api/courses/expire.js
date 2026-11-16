import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server configuration missing' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { data, error } = await supabase
      .from('courses_new')
      .update({ review_status: 'Archived', updated_at: new Date().toISOString() })
      .lt('course_expires', today)
      .or('review_status.is.null,review_status.neq.Archived')
      .select('id');

    if (error) {
      throw error;
    }

    res.status(200).json({ archivedCount: data.length });
  } catch (error) {
    console.error('Expired course archival failed:', error);
    res.status(500).json({ error: error.message || 'Unable to archive expired courses' });
  }
}