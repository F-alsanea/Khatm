// Script: تحسين الوصول لسلوك الأسئلة الشائعة (FAQ)
// يفعل التبديل بالماوس أو بالكيبورد (Enter / Space) ويحدث aria-expanded
document.addEventListener('DOMContentLoaded', () => {
  const faqList = document.getElementById('faqList');
  if (!faqList) return;
  const items = Array.from(faqList.querySelectorAll('.faq-item'));

  items.forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;

    // قابلية الوصول: دور وسطي، تبويب، وحالة مبدئية
    q.setAttribute('tabindex', '0');
    q.setAttribute('role', 'button');
    q.setAttribute('aria-expanded', item.classList.contains('open') ? 'true' : 'false');

    const toggle = (e) => {
      const wasOpen = item.classList.contains('open');
      // أغلق الباقي
      items.forEach(it => {
        it.classList.remove('open');
        const qEl = it.querySelector('.faq-q');
        if (qEl) qEl.setAttribute('aria-expanded', 'false');
      });
      // افتح إذا كان مغلق
      if (!wasOpen) {
        item.classList.add('open');
        q.setAttribute('aria-expanded', 'true');
      }
    };

    q.addEventListener('click', toggle);
    q.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle(e);
      }
    });
  });
});
