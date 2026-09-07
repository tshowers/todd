export type ToddMediaOrientation = 'short' | 'wide';

export interface ToddMediaItem {
    module_id: string;
    type: string;
    best_for: string[];
    url: string;
    description: string;
    orientation: ToddMediaOrientation;
    keywords: string[];
    why: string;
}

function deriveOrientation ( url: string ): ToddMediaOrientation {
    return /youtube\.com\/shorts\//i.test( url ) ? 'short' : 'wide';
}

function deriveKeywords ( item: { module_id: string; best_for: string[]; description: string; type: string; } ): string[] {
    const parts = [
        item.module_id,
        ...( item.best_for || [] ),
        item.description || '',
        item.type || ''
    ];

    const text = parts.join( ' ' ).toLowerCase();
    const normalized = text
        .replace( /[^a-z0-9\s]/g, ' ' )
        .split( /\s+/ )
        .map( token => token.trim() )
        .filter( Boolean );

    return Array.from( new Set( normalized ) );
}

function deriveWhy ( item: { best_for: string[]; description: string; type: string; } ): string {
    const bucket = item.best_for?.[0] || 'all';

    switch ( bucket ) {
        case 'outreach':
            return 'This video shows how TODD helps create momentum with outreach and follow-through.';
        case 'moves':
            return 'This video shows how TODD keeps work from stalling and helps you follow through.';
        case 'pulse':
            return 'This video shows how TODD helps turn customer feedback into something useful.';
        case 'lead_vault':
            return 'This video shows how TODD helps surface buyers and lead opportunities faster.';
        case 'knowledge':
            return 'This video shows how TODD helps you reuse what you already know instead of starting over.';
        case 'docs':
            return 'This video shows how TODD helps keep document-heavy work moving.';
        case 'ai':
            return 'This video shows how TODD uses AI to move work forward, not just generate text.';
        default:
            if ( item.type === 'testimonial' ) {
                return 'This testimonial shows what it feels like when TODD removes friction from the work.';
            }
            return 'This video helps explain how TODD removes friction and keeps work moving.';
    }
}

function enrichMedia<T extends { module_id: string; type: string; best_for: string[]; url: string; description: string; }> ( items: T[] ): ToddMediaItem[] {
    return items.map( item => ( {
        ...item,
        orientation: deriveOrientation( item.url ),
        keywords: deriveKeywords( item ),
        why: deriveWhy( item )
    } ) );
}

export const RAW_VIDEOS = [
    {
        module_id: 'video_todd_hit_my_number',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/VY3kOg1zmfw',
        description: 'How can TODD help me hit my number?'
    },
    {
        module_id: 'video_todd_more_free_time_feel',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/nFcWSW4N5c8',
        description: 'How does getting used to more free time feel?'
    },
    {
        module_id: 'video_todd_follow_through_makes_work_stand_out',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/Zeabs9OZhgs',
        description: 'What makes work stand out is follow-through.'
    },
    {
        module_id: 'video_todd_i_dont_chase_follow_ups_anymore',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/T8-gDGuqZD0',
        description: 'I do not chase follow-ups anymore.'
    },
    {
        module_id: 'video_todd_stand_out_and_save_time',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/wHBXVWNjK9o',
        description: 'Stand out and save time with work that keeps moving.'
    },
    {
        module_id: 'video_todd_automation_without_asking',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/9p3ni8QtBHI',
        description: 'When automation happens without asking.'
    },
    {
        module_id: 'video_todd_momentum_makes_you_stand_out',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/Asmdn0ewkTs',
        description: 'Did you know momentum makes you stand out?'
    },
    {
        module_id: 'video_todd_what_happens_next_makes_you_stand_out',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/otEk1UwjVf0',
        description: 'What happens next is what makes you stand out.'
    },
    {
        module_id: 'video_todd_stand_out_by_following_through',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/7zYqQW_OreA',
        description:
            'Did you know you can stand out more just by following through?'
    },
    {
        module_id: 'video_todd_responsible_use_of_technology',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/RnILY0yGP0Y',
        description: 'Responsible use of technology and its impact on momentum.'
    },
    {
        module_id: 'video_todd_work_moves_forward',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/CwJK94-h7Lk',
        description: 'When you’re ready for work to actually move forward.'
    },
    {
        module_id: 'video_todd_survey_analysis_help',
        type: 'video',
        best_for: ['pulse'],
        url: 'https://youtube.com/shorts/EtRE1t3lAgU',
        description:
            'Why analyzing survey results requires more than surface-level thinking.'
    },
    {
        module_id: 'video_todd_ai_handles_the_work',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/hkkawhkp3ng',
        description: 'What it feels like when AI actually carries the work forward.'
    },
    {
        module_id: 'video_todd_automatic_lead_generation',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/YZEF7I3D6XY',
        description: 'TODD’s approach to automatic lead generation.'
    },
    {
        module_id: 'video_todd_travel_industry_meetings_problem',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/7Q4EOwIy2_s',
        description: 'Why disruption often turns into endless meetings.'
    },
    {
        module_id: 'video_todd_healthcare_compliance_bottleneck',
        type: 'video',
        best_for: ['docs'],
        url: 'https://youtube.com/shorts/t_U8pxAuBe0',
        description: 'Why compliance becomes a bottleneck in healthcare.'
    },
    {
        module_id: 'video_todd_lead_generation_story',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/kD54U9iY02U',
        description: 'A real story behind automatic lead generation.'
    },
    {
        module_id: 'video_todd_lead_generation_with_todd',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/E8EcSF3IYh4',
        description: 'Automatic lead generation powered by TODD.'
    },
    {
        module_id: 'video_todd_construction_project_delays',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/Dtv9KB9uaVQ',
        description: 'What slows down construction projects and how to fix it.'
    },
    {
        module_id: 'video_todd_free_time_problem',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/QCeJozTTeLs',
        description: 'Why you don’t actually have a free time problem.'
    },
    {
        module_id: 'video_lead_vault_leads_ready_to_purchase',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/y4jJ4LRzfag',
        description: 'Leads ready to purchase.'
    },
    {
        module_id: 'video_lead_vault_enriched_leads_waiting_to_buy',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/_Emf6ULNKUI',
        description: 'Enriched leads waiting to buy your product or service.'
    },
    {
        module_id: 'video_todd_demystifying_artificial_intelligence',
        type: 'explainer',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/0HiA7Zd_Ob0',
        description: 'Demystifying artificial intelligence.'
    },
    {
        module_id: 'video_todd_best_way_to_growth_my_business_follow_up',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/N4paRM-JyWg',
        description: "What's the best way to grow my business? Follow-up matters."
    },
    {
        module_id: 'video_todd_best_way_to_grow_my_business',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/cD3N4jvjUho',
        description: "What's the best way to grow my business?"
    },
    {
        module_id: 'video_todd_cant_keep_track_of_everything',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/NrKUpApf5G8',
        description: "I can't keep track of everything I need to do."
    },
    {
        module_id: 'video_todd_difference_between_todd_and_copilot_tools',
        type: 'explainer',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/ww3Mtp5jBwo',
        description: 'The difference between TODD and copilot tools.'
    },
    {
        module_id: 'video_todd_explainer_how_ai_actually_works',
        type: 'explainer',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/XBSLtItGng8',
        description: 'Explainer: how AI actually works.'
    },
    {
        module_id: 'video_todd_a_better_you_awaits_short',
        type: 'video',
        best_for: ['all'],
        url: 'https://youtube.com/shorts/iIM_IqdYPDw',
        description: 'A better you awaits.'
    },
    {
        module_id: 'video_lead_vault_find_buyers_already_looking',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/-mvnXUhJDbg',
        description: 'Find buyers already looking.'
    },
    {
        module_id: 'video_todd_cognitive_cost_of_ai',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/sXTZilnFAtg',
        description: 'The cognitive cost of AI.'
    },
    {
        module_id: 'video_lead_vault_find_buyers_already_looking_alt',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/fh-919enKE4',
        description: 'Lead Vault: find buyers already looking.'
    },

    {
        module_id: 'video_lead_vault_find_buyers_already_looking_10s',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/lnPwTquQng4',
        description: 'Lead Vault: find buyers already looking.'
    },
    {
        module_id: 'video_lead_vault_find_buyers_already_looking_orange',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/vvhRaLUq-w4',
        description: 'Lead Vault: find buyers already looking.'
    },
    {
        module_id: 'video_lead_vault_find_buyers_already_looking_green',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/EuBGgFujGMs',
        description: 'Lead Vault: find buyers already looking.'
    },
    {
        module_id: 'video_pulse_ask_a_question_learn_everything',
        type: 'video',
        best_for: ['pulse'],
        url: 'https://youtube.com/shorts/nWSaOCf6yw4',
        description: 'Pulse: ask a question. Learn everything.'
    },
    {
        module_id: 'video_lead_vault_find_buyers_already_looking_blue',
        type: 'video',
        best_for: ['lead_vault'],
        url: 'https://youtube.com/shorts/Gc8s9pdV5pY',
        description: 'Lead Vault: find buyers already looking.'
    },
    {
        module_id: 'video_todd_how_a_business_momentum_system_works',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/du5xRVP6VWc',
        description: 'How a Momentum System works.'
    },
    {
        module_id: 'video_todd_getting_started_part_1',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/Ek7Te_jVKYk',
        description: 'Getting started with TODD, part 1.'
    },
    {
        module_id: 'video_todd_why_companies_abandon_crm',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/qCV2ae_NAko',
        description: 'Why companies abandon CRM.'
    },
    {
        module_id: 'video_todd_hidden_cost_of_crms',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/X1ucEu4Jb8k',
        description: 'The hidden cost of CRMs.'
    },
    {
        module_id: 'video_todd_automatic_lead_generation_and_knowledge_management',
        type: 'video',
        best_for: ['knowledge'],
        url: 'https://youtube.com/shorts/QqSsI6AdBzg',
        description:
            'Have TODD help with automatic lead generation and knowledge management.'
    },
    {
        module_id: 'video_todd_how_much_work_happens_everyday',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/VjOaoGuzJSg',
        description:
            'How much work happens everyday? Are you using the right tools?'
    },
    {
        module_id: 'video_todd_you_too_can_be_remarkable',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/WZOZOhG7Wa4',
        description: 'You too can be remarkable just by moving work forward.'
    },
    {
        module_id: 'video_todd_why_do_projects_slow_down',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtube.com/shorts/dP2lfHGYhJc',
        description: 'Why do projects slow down?'
    },

    {
        module_id: 'video_todd_vs_crm',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtu.be/RsDSoZvicLQ',
        description: "Still using CRMs? 2000 Technology? It's 2026, time for a Momentum System"
    },
    {
        module_id: 'video_todd_philosophy_1',
        type: 'explainer',
        best_for: ['outreach'],
        url: 'https://youtu.be/Yeo6kTcUryU',
        description: 'How TODD quietly handles outreach, follow-ups, and momentum.'
    },
    {
        module_id: 'video_todd_moves',
        type: 'video',
        best_for: ['moves'],
        url: 'https://youtu.be/YE_Dy3lqlQU',
        description: 'How TODD helps you become more remarkable.'
    },
    {
        module_id: 'video_todd_ai',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtu.be/QrpW9jowSKY',
        description: 'TODD and AI'
    },
    {
        module_id: 'video_todd_affiliate',
        type: 'video',
        best_for: ['all'],
        url: 'https://youtu.be/mHJsljdd-q8',
        description: 'About the TODD affiliate program'
    },
    {
        module_id: 'video_todd_partner',
        type: 'video',
        best_for: ['all'],
        url: 'https://youtu.be/vrv_ZQ-uhH4',
        description: 'About the TODD partner program'
    },
    {
        module_id: 'video_todd_different_than_crm',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/ag6LK41dqVE',
        description: 'How is TODD different from a CRM?'
    },
    {
        module_id: 'video_todd_working',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/tNVQEjgWxoo',
        description: 'You say TODD does the work — how?'
    },
    {
        module_id: 'video_todd_sales',
        type: 'video',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/Tq5MGgvaWkY',
        description: 'Is this only for sales?'
    },
    {
        module_id: 'video_todd_and_teams',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/tzY2B06eK4I',
        description: 'Does TODD replace my team?'
    },
    {
        module_id: 'video_todd_and_bms',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/dB2C3Qja0zY',
        description: 'What is a Momentum System?'
    },
    {
        module_id: 'video_todd_philosophy_2',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/AYlrdZHhaRI',
        description: 'When Software Tracks Work but Does not Move it'
    },

    {
        module_id: 'video_todd_ai_wrong',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/AKoYV4Mms54',
        description: 'Why Most Companies Use AI the Wrong Way'
    },

    {
        module_id: 'video_todd_tracking_vs_moving',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/Nr_1ybsk6i8',
        description: 'Tracking Work vs Moving Work Forward'
    },

    {
        module_id: 'video_and_website_design_consulting',
        type: 'video',
        best_for: ['web_dev'],
        url: 'https://youtu.be/x7WFnj7A9lo',
        description: 'Website Design That Feels Human'
    },
    {
        module_id: 'video_and_ai_dashboards_consulting',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtu.be/FKIvMFJpubo',
        description: 'Design and AI Powered Dashboards'
    },
    {
        module_id: 'video_machine_learning_consulting',
        type: 'video',
        best_for: ['ai'],
        url: 'https://youtu.be/PKlCCvy_N-c',
        description: 'Machine Learning Consulting'
    },
    {
        module_id: 'video_api_design_consulting',
        type: 'video',
        best_for: ['apis'],
        url: 'https://youtu.be/OopgSISYvP4',
        description: 'API Design and Strategy'
    },
    {
        module_id: 'video_cloud_architecture_consulting',
        type: 'video',
        best_for: ['cloud'],
        url: 'https://youtu.be/1j9fce8Vmp0',
        description: 'Cloud Architecture'
    },
    {
        module_id: 'video_software_consulting',
        type: 'video',
        best_for: ['all'],
        url: 'https://youtu.be/y2pJl-pStbo',
        description: 'Choosing the right Partner'
    },
    {
        module_id: 'video_cloud_and_api_consulting',
        type: 'video',
        best_for: ['all'],
        url: 'https://youtu.be/1Gbagj_OaNM',
        description: 'Strategy, AI, Cloud, APIs'
    },
    {
        module_id: 'video_passwordless_consulting',
        type: 'explainer',
        best_for: ['security'],
        url: 'https://youtu.be/BooqORRFmJQ',
        description: 'Passwordless Authentication'
    },
    {
        module_id: 'video_about_taliferro',
        type: 'explainer',
        best_for: ['all'],
        url: 'https://youtu.be/D2BlJ2eclwA',
        description: 'About Taliferro'
    },
    {
        module_id: 'video_about_todd_affiliate_program',
        type: 'explainer',
        best_for: ['all'],
        url: 'https://youtu.be/ZPYJ7u5zvFQ',
        description: 'TODD Affiliate Program: Earn up to $5,000 per referral'
    },
    {
        module_id: 'video_about_todd_reseller_program',
        type: 'explainer',
        best_for: ['all'],
        url: 'https://youtu.be/xQgu_E7chig',
        description: 'TODD reseller program: add recurring revenue'
    }
];

export const RAW_TESTIMONIALS = [
    {
        module_id: 'testimonial_todd_discovery',
        type: 'testimonial',
        best_for: ['outreach'],
        url: 'https://youtube.com/shorts/T8-gDGuqZD0',
        description: 'The power of the follow-up.'
    },
    {
        module_id: 'testimonial_todd_ai',
        type: 'testimonial',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/9p3ni8QtBHI',
        description:
            'Explains why people begin to trust AI systems when work continues without constant input or supervision.'
    },
    {
        module_id: 'testimonial_todd_auto',
        type: 'testimonial',
        best_for: ['ai'],
        url: 'https://youtube.com/shorts/zVSfy92UqVk',
        description: "TODD's powerful automation"
    },
    {
        module_id: 'testimonial_todd_caring',
        type: 'testimonial',
        best_for: ['ai'],
        url: 'https://youtu.be/1D4g81GTfqQ',
        description: "With TODD, I feel like I'm being quietly looked after."
    }
];

export const VIDEOS: ToddMediaItem[] = enrichMedia( RAW_VIDEOS );
export const TESTIMONIALS: ToddMediaItem[] = enrichMedia( RAW_TESTIMONIALS );