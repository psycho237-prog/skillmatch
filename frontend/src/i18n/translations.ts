export const translations = {
  en: {
    // Common
    app_name: 'SkillMatch',
    tagline: 'Connecting You to the Right Skills.',
    welcome_title: "Let's Get You Closer\nTo ",
    welcome_highlight: 'Your Ideal Service',
    welcome_subtitle: 'Login to SkillMatch with Google',
    sign_up_google: 'Sign Up with Google',
    welcome_to: 'WELCOME TO SKILLMATCH',

    // Home
    good_morning: 'Good Morning',
    good_afternoon: 'Good Afternoon',
    good_evening: 'Good Evening',
    search_placeholder: 'Search something',
    featured: 'Featured',
    see_all: 'See All',
    our_recommendation: 'Our Recommendation',
    per_hour: '/hr',
    negotiable: 'Negotiable',
    exchange: 'Exchange',
    fixed: 'Fixed',

    // Categories
    all: 'All',
    development: 'Development',
    design: 'Design',
    writing: 'Writing',
    teaching: 'Teaching',
    photography: 'Photography',
    music: 'Music',
    fitness: 'Fitness',
    cooking: 'Cooking',
    repair: 'Repair',
    cleaning: 'Cleaning',
    driving: 'Driving',
    beauty: 'Beauty',
    translation: 'Translation',
    marketing: 'Marketing',
    other: 'Other',

    // Explore
    explore: 'Explore',
    search_services: 'Search for Your Ideal Service',
    found_services: 'Found {count} Services',
    no_results: 'No Results',
    no_results_desc: 'Sorry, we couldn\'t find any services matching your search.',

    // Filter
    filter: 'Filter',
    reset: 'Reset',
    price_range: 'Price Range',
    service_type: 'Service Type',
    service_details: 'Service Details',
    experience: 'Experience',
    set_filter: 'Set Filter',
    rating_filter: 'Minimum Rating',

    // Detail
    description: 'Description',
    gallery: 'Gallery',
    location: 'Location',
    reviews: 'reviews',
    contact_now: 'Contact Now',
    price: 'PRICE',

    // Chat
    chat: 'Chat',
    messages: 'Messages',
    type_message: 'Type a message...',
    no_conversations: 'No conversations yet',
    no_conversations_desc: 'Start a conversation by contacting a service provider.',

    // Profile
    profile: 'Profile',
    my_services: 'My Services',
    notifications_setting: 'Notification',
    security: 'Security',
    language: 'Language',
    help_center: 'Help Center',
    invite_friends: 'Invite Friends',
    logout: 'Logout',
    settings: 'Settings',
    edit_profile: 'Edit Profile',
    display_name: 'Display Name',
    save: 'Save',
    cancel: 'Cancel',
    theme: 'Theme',
    theme_system: 'System',
    theme_light: 'Light',
    theme_dark: 'Dark',
    english: 'English',
    french: 'French',

    // Post Service
    post_service: 'Post a Service',
    title: 'Title',
    category: 'Category',
    add_images: 'Add Images',
    publish: 'Publish',
  },
  fr: {
    // Common
    app_name: 'SkillMatch',
    tagline: 'Connecter aux bonnes compétences.',
    welcome_title: "Rapprochons-vous\nDe ",
    welcome_highlight: 'Votre Service Idéal',
    welcome_subtitle: 'Connectez-vous à SkillMatch avec Google',
    sign_up_google: "S'inscrire avec Google",
    welcome_to: 'BIENVENUE SUR SKILLMATCH',

    // Home
    good_morning: 'Bonjour',
    good_afternoon: 'Bon après-midi',
    good_evening: 'Bonsoir',
    search_placeholder: 'Rechercher quelque chose',
    featured: 'En vedette',
    see_all: 'Tout voir',
    our_recommendation: 'Nos Recommandations',
    per_hour: '/h',
    negotiable: 'Négociable',
    exchange: 'Échange',
    fixed: 'Fixe',

    // Categories
    all: 'Tous',
    development: 'Développement',
    design: 'Design',
    writing: 'Rédaction',
    teaching: 'Enseignement',
    photography: 'Photographie',
    music: 'Musique',
    fitness: 'Fitness',
    cooking: 'Cuisine',
    repair: 'Réparation',
    cleaning: 'Nettoyage',
    driving: 'Transport',
    beauty: 'Beauté',
    translation: 'Traduction',
    marketing: 'Marketing',
    other: 'Autre',

    // Explore
    explore: 'Explorer',
    search_services: 'Rechercher Votre Service Idéal',
    found_services: '{count} Services trouvés',
    no_results: 'Aucun résultat',
    no_results_desc: 'Désolé, nous n\'avons trouvé aucun service correspondant à votre recherche.',

    // Filter
    filter: 'Filtrer',
    reset: 'Réinitialiser',
    price_range: 'Fourchette de prix',
    service_type: 'Type de service',
    service_details: 'Détails du service',
    experience: 'Expérience',
    set_filter: 'Appliquer le filtre',
    rating_filter: 'Note minimale',

    // Detail
    description: 'Description',
    gallery: 'Galerie',
    location: 'Localisation',
    reviews: 'avis',
    contact_now: 'Contacter',
    price: 'PRIX',

    // Chat
    chat: 'Discussion',
    messages: 'Messages',
    type_message: 'Écrire un message...',
    no_conversations: 'Aucune conversation',
    no_conversations_desc: 'Commencez une conversation en contactant un prestataire.',

    // Profile
    profile: 'Profil',
    my_services: 'Mes Services',
    notifications_setting: 'Notifications',
    security: 'Sécurité',
    language: 'Langue',
    help_center: "Centre d'aide",
    invite_friends: 'Inviter des amis',
    logout: 'Déconnexion',
    settings: 'Paramètres',
    edit_profile: 'Modifier le profil',
    display_name: "Nom d'affichage",
    save: 'Enregistrer',
    cancel: 'Annuler',
    theme: 'Thème',
    theme_system: 'Système',
    theme_light: 'Clair',
    theme_dark: 'Sombre',
    english: 'Anglais',
    french: 'Français',

    // Post Service
    post_service: 'Publier un service',
    title: 'Titre',
    category: 'Catégorie',
    add_images: 'Ajouter des images',
    publish: 'Publier',
  },
};

export type TranslationKey = keyof typeof translations.en;
export type Language = 'en' | 'fr';
