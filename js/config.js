// การตั้งค่าระบบ
const CONFIG = {
    supabaseUrl: 'https://zmvignozovaoozldzirn.supabase.co',
    supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inptdmlnbm96b3Zhb296bGR6aXJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMzYxODcsImV4cCI6MjEwNjkxMjE4N30.cSESHsBoKudHG_pO5PiROW4V5M4bx4yMKghWMa6tAMU'
};

// การตั้งค่า Tailwind CSS
tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#E2578F',
                    dark: '#C93E78',
                    light: '#FFE6EF'
                }
            },
            fontFamily: {
                kanit: ['Kanit', 'sans-serif'],
            }
        }
    }
};
