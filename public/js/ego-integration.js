document.addEventListener('DOMContentLoaded', async () => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let site;
  try {
    const r = await fetch('/api/site'); if (!r.ok) return; site = await r.json();
  } catch { return; }
  const st = site.settings || {};
  if (st.siteTitle) document.title = document.title.replace(/EGO PvP[^-–]*/, st.siteTitle);
  if (st.accent) document.documentElement.style.setProperty('--purple-glow', st.accent);
  document.querySelectorAll('a[href="discord.html"], a[href="#discord"]').forEach(a => {
    if (st.discordInvite) { a.href = st.discordInvite; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  });
  const grid = document.querySelector('#egoTeamGrid') || document.querySelector('.team-grid');
  if (grid) {
    const staff = Array.isArray(site.staff) ? [...site.staff].sort((a,b)=>(a.order||0)-(b.order||0)) : [];
    grid.innerHTML = staff.length ? staff.map(m => `<article class="team-card reveal visible"><div class="team-avatar">${m.image ? `<img src="${esc(m.image)}" alt="${esc(m.name)}" loading="lazy">` : `<span>${esc((m.name||'E').slice(0,1).toUpperCase())}</span>`}</div><h3 class="team-member-name">${esc(m.name)}</h3><span class="team-member-role">${esc(m.role)}</span><p class="team-member-desc">${esc(m.description||'')}</p><div class="team-card-actions">${m.links ? `<a href="${esc(m.links)}" target="_blank" rel="noopener noreferrer" aria-label="Contact ${esc(m.name)}"><i class="fas fa-link"></i></a>` : ''}</div></article>`).join('') : '<div class="empty-state"><h3>EGO PvP Team</h3><p>The team list is being prepared. Authorized administrators can add members from the admin panel.</p><a class="btn btn-primary" href="/admin">Open Admin Panel</a></div>';
  }

  const announcementItems = (site.announcements || []).filter(a=>a.active && a.title && a.body);
  if (announcementItems.length && document.querySelector('.hero')) {
    const band = document.createElement('section'); band.className='ego-announcements container';
    band.innerHTML = `<div class="ego-announcement-head"><span class="section-tag">COMMUNITY UPDATES</span><strong>Latest from EGO</strong></div>` + announcementItems.map(a=>`<article class="ego-announcement"><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p></article>`).join('');
    document.querySelector('.hero').insertAdjacentElement('afterend',band);
  }
  if (site.maintenanceMode) {
    const notice=document.createElement('div'); notice.className='ego-maintenance-notice'; notice.setAttribute('role','status');
    notice.innerHTML=`<strong>MAINTENANCE MODE</strong><span>${esc(site.settings?.maintenanceMessage || 'We will be back soon.')}</span>`;
    document.body.prepend(notice);
  }
  const visit = {event:'enter',page:location.pathname};
  fetch('/api/activity/visit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(visit)}).catch(()=>{});
});