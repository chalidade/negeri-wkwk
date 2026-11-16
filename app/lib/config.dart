/// Diisi lewat --dart-define atau --dart-define-from-file=env.json.
/// Anon/publishable key memang boleh ada di aplikasi. Service role key JANGAN.
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

bool get isConfigured => supabaseUrl.isNotEmpty && supabaseAnonKey.isNotEmpty;
