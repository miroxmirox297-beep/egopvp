/* ============================================================
   VORTEX DEVELOPMENT - Main Script
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. Navigation & Scroll Effects ---
    const navbar = document.getElementById('navbar');
    const scrollTopBtn = document.getElementById('scrollTop');
    
    window.addEventListener('scroll', () => {
        // Navbar Scrolled State
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Scroll Top Button Visibility
        if (window.scrollY > 500) {
            scrollTopBtn.classList.add('show');
        } else {
            scrollTopBtn.classList.remove('show');
        }
    });

    scrollTopBtn?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- 2. Mobile Burger Menu ---
    const burger = document.getElementById('burger');
    const navLinks = document.getElementById('nav-links');

    burger?.addEventListener('click', () => {
        burger.classList.toggle('active');
        navLinks.classList.toggle('mobile-open');
    });

    // --- 3. Disclaimer Banner ---
    const disclaimer = document.getElementById('disclaimer');
    const closeDisclaimer = document.getElementById('closeDisclaimer');

    if (localStorage.getItem('vortexDisclaimerClosed') === 'true') {
        disclaimer?.classList.add('hidden');
    }

    closeDisclaimer?.addEventListener('click', () => {
        disclaimer.classList.add('hidden');
        localStorage.setItem('vortexDisclaimerClosed', 'true');
    });

    // --- 4. Reveal Animations on Scroll ---
    const revealElements = document.querySelectorAll('.reveal, .reveal-left');
    
    const revealOnScroll = () => {
        const windowHeight = window.innerHeight;
        const revealPoint = 50;

        revealElements.forEach(el => {
            const revealTop = el.getBoundingClientRect().top;
            if (revealTop < windowHeight - revealPoint) {
                el.classList.add('visible');
            }
        });
    };

    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger on load

    // --- 5. Background Stars Generator ---
    const starsContainer = document.getElementById('stars-container');
    if (starsContainer) {
        for (let i = 0; i < 50; i++) {
            let star = document.createElement('div');
            star.classList.add('star');
            
            // Random properties
            let size = Math.random() * 3 + 1;
            let left = Math.random() * 100;
            let duration = Math.random() * 3 + 2;
            let delay = Math.random() * 5;

            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            star.style.left = `${left}%`;
            star.style.bottom = `-10px`;
            star.style.animationDuration = `${duration}s`;
            star.style.animationDelay = `${delay}s`;

            starsContainer.appendChild(star);
        }
    }

    // --- 6. Rules Accordion & Filtering ---
    const ruleHeaders = document.querySelectorAll('.rule-header');
    ruleHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const card = this.closest('.rule-card');
            const detail = card.querySelector('.rule-detail');
            const btn = card.querySelector('.rule-toggle-btn');
            
            // Close all others
            document.querySelectorAll('.rule-detail').forEach(d => {
                if(d !== detail) d.classList.remove('expanded');
            });
            document.querySelectorAll('.rule-toggle-btn').forEach(b => {
                if(b !== btn) b.classList.remove('open');
            });

            detail.classList.toggle('expanded');
            btn.classList.toggle('open');
        });
    });

    const filterBtns = document.querySelectorAll('.rules-filter-btn');
    const ruleCards = document.querySelectorAll('.rule-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            ruleCards.forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                    card.style.display = 'block';
                    setTimeout(() => card.style.opacity = '1', 50);
                } else {
                    card.style.opacity = '0';
                    setTimeout(() => card.style.display = 'none', 300);
                }
            });
        });
    });

    // --- 7. Modal Closing by clicking outside ---
    const heistModal = document.getElementById('heistModal');
    heistModal?.addEventListener('click', (e) => {
        if (e.target === heistModal) {
            closeHeistModal();
        }
    });

});

// --- Heist Data & Modal Functions ---
const heistsData = {
    'store': {
        title: 'Convenience Store | متجر صغير',
        rules: [
            "Minimum <b>0 LEOs</b> on duty. (لا يوجد حد أدنى للشرطة)",
            "Maximum attackers: <b>2 crew members</b>.",
            "No hostages required.",
            "The robbery must have a valid IC motive (e.g., quick cash, desperation)."
        ]
    },
    'jewelry': {
        title: 'Vangelico Jewelry | مجوهرات فانجليكو',
        rules: [
            "Minimum <b>3 LEOs</b> on duty. (الحد الأدنى 3 ضباط)",
            "Maximum attackers: <b>4 crew members</b>.",
            "One genuine hostage required.",
            "Hacking and specialized tools are necessary."
        ]
    },
    'bank': {
        title: 'Fleeca Bank | بنك فليكا',
        rules: [
            "Minimum <b>4 LEOs</b> on duty. (الحد الأدنى 4 ضباط)",
            "Maximum attackers: <b>3 crew members</b>.",
            "Requires two genuine hostages.",
            "Advanced vault drilling and hacking expertise."
        ]
    },
    'yacht': {
        title: 'Super Yacht Heist | يخت سوبر',
        rules: [
            "Minimum <b>6 LEOs</b> on duty (includes air/sea support). (الحد الأدنى 6 ضباط)",
            "Maximum attackers: <b>5 crew members</b>.",
            "Requires breaching team and strong naval/air escape plan.",
            "High-risk, high-reward, full RP required from start to finish."
        ]
    }
};

window.openHeistModal = function(id) {
    const modal = document.getElementById('heistModal');
    const title = document.getElementById('modalTitle');
    const rulesList = document.getElementById('modalRulesList');
    
    const data = heistsData[id];
    if(!data) return;

    title.innerText = data.title;
    rulesList.innerHTML = '';

    data.rules.forEach(rule => {
        let li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-check-circle"></i> <span>${rule}</span>`;
        rulesList.appendChild(li);
    });

    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

window.closeHeistModal = function() {
    const modal = document.getElementById('heistModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
};