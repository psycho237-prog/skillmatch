// API & App Configuration
const ENV = {
  API_URL: __DEV__ ? 'http://10.0.2.2:3000/api' : 'https://your-production-url.com/api',
  SOCKET_URL: __DEV__ ? 'http://10.0.2.2:3000' : 'https://your-production-url.com',
  SUPABASE_URL: 'https://rytcxyytweorvtubyomx.supabase.co/rest/v1/',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5dGN4eXl0d2VvcnZ0dWJ5b214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTg2ODAsImV4cCI6MjA5NjA5NDY4MH0.AZKArVh1omI5ly0ujOyLzpBaADUxbmc4XzeoQGBkVX8',
  GOOGLE_WEB_CLIENT_ID: '912563311330-glgkqho2tba3rrdqacisk4gfpan3tq7o.apps.googleusercontent.com',
  GOOGLE_ANDROID_CLIENT_ID: '912563311330-eu95vdu0n7o4t5i48ll50lpn2mk3u32r.apps.googleusercontent.com',
  GOOGLE_IOS_CLIENT_ID: 'your_google_ios_client_id_here',


};

export default ENV;
