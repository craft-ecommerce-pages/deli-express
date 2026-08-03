(function(){
  'use strict';

  /* ── STATE ── */
  let cartItems = [];
  let favs = [];
  let products = [];
  let config = {};
  let activeFilter = 'all';   // 'all' | <slug> | '__offers__' | '__favs__'
  let searchQuery = '';
  let categorySlugs = [];

  let modalProduct = null, modalQty = 1, modalVariants = {}, sliderIdx = 0, sliderImages = [];

  /* ── DOM REFS ── */
  const $catalog=document.getElementById('catalog'),$searchInput=document.getElementById('searchInput'),
    $catStrip=document.getElementById('catStrip'),$cartOverlay=document.getElementById('cartOverlay'),
    $cartDrawer=document.getElementById('cartDrawer'),$cartClose=document.getElementById('cartClose'),
    $cartItems=document.getElementById('cartItems'),$cartTotal=document.getElementById('cartTotal'),
    $cartItemCount=document.getElementById('cartItemCount'),$btnCheckout=document.getElementById('btnCheckout'),
    $toast=document.getElementById('toast'),$modalOverlay=document.getElementById('modalOverlay'),
    $modalClose=document.getElementById('modalClose'),$modalFav=document.getElementById('modalFav'),
    $sliderTrack=document.getElementById('sliderTrack'),$sliderPrev=document.getElementById('sliderPrev'),
    $sliderNext=document.getElementById('sliderNext'),$sliderDots=document.getElementById('sliderDots'),
    $modalDetail=document.getElementById('modalDetail'),$navBadge=document.getElementById('navBadge'),
    $cartPeek=document.getElementById('cartPeek'),$peekCount=document.getElementById('peekCount'),
    $peekTotal=document.getElementById('peekTotal');

  /* ── HELPERS ── */
  const normalize=s=>(s||'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

  function parsePrice(p){
    if(typeof p.precio==='number') return p.precio;
    const m=(p.precio||'').toString().match(/[\d.]+/);
    return m?parseFloat(m[0]):0;
  }
  const getImages=p=>Array.isArray(p.imagenes)&&p.imagenes.length?p.imagenes:(p.imagen?[p.imagen]:[]);
  const getOptionKey=o=>(typeof o==='object'&&o!==null)?(o.label||''):String(o);
  const getOptionDisplay=getOptionKey;
  const getOptionPrice=o=>(typeof o==='object'&&o!==null&&typeof o.price==='number')?o.price:null;

  function getEffectivePrice(p,variantes){
    if(!variantes||!Object.keys(variantes).length) return parsePrice(p);
    if(Array.isArray(p.variantes)){
      for(const g of p.variantes){
        const sel=variantes[g.name];
        if(sel!==undefined){
          const opt=g.options.find(o=>getOptionKey(o)===sel);
          const vp=opt?getOptionPrice(opt):null;
          if(vp!==null) return vp;
        }
      }
    }
    return parsePrice(p);
  }
  function formatPrice(n){
    const c=config.currency||'$';
    const d=Math.abs(n)<10?2:(Number.isInteger(n)?0:2);
    return c+n.toFixed(d);
  }
  const cartKey=(id,v)=>(!v||!Object.keys(v).length)?String(id):id+':'+Object.entries(v).sort().map(([k,x])=>k+'='+x).join(',');
  const variantLabel=v=>(!v||!Object.keys(v).length)?'':Object.entries(v).map(([,x])=>x).join(' · ');

  function getStockInfo(p){
    if(p.stock===0) return {badge:'Agotado',cls:'sold-out',canAdd:false,maxQty:0};
    if(typeof p.stock==='number'&&p.stock>=1&&p.stock<=3) return {badge:'¡Quedan pocas!',cls:'low-stock',canAdd:true,maxQty:p.stock};
    return {badge:null,cls:'',canAdd:true,maxQty:Infinity};
  }
  const badgeCat=()=>config.badge_category||null;
  const isOffer=p=>!!p.precio_promo||(badgeCat()&&(p.categorias||[]).includes(badgeCat()));

  // Category → emoji icon (keyword match on slug + visible name)
  const CAT_ICONS=[['hamburg','🍔'],['burger','🍔'],['pizza','🍕'],['pollo','🍗'],['alit','🍗'],['wing','🍗'],
    ['papa','🍟'],['frit','🍟'],['acompa','🍟'],['bebida','🥤'],['refres','🥤'],['gaseosa','🥤'],['jugo','🧃'],
    ['cafe','☕'],['café','☕'],['combo','🍱'],['postre','🍰'],['dulce','🍰'],['helado','🍦'],['ensalada','🥗'],
    ['sushi','🍣'],['taco','🌮'],['burrito','🌯'],['wrap','🌯'],['sandwi','🥪'],['hot dog','🌭'],['hotdog','🌭'],
    ['perro','🌭'],['salchi','🌭'],['nacho','🧀'],['queso','🧀'],['carne','🥩'],['parrilla','🥩'],['asado','🥩'],
    ['pasta','🍝'],['sopa','🍲'],['caldo','🍲'],['marisc','🦐'],['camaron','🦐'],['ceviche','🦐'],['pescado','🐟'],
    ['desayuno','🍳'],['huevo','🍳'],['pan','🥖'],['empana','🥟'],['dona','🍩'],['galleta','🍪'],['pastel','🎂'],
    ['torta','🎂'],['fruta','🍓'],['vega','🥗'],['bowl','🥣'],['arroz','🍚']];
  function catIcon(slug,name){
    const s=normalize(slug+' '+(name||''));
    for(const [k,ic] of CAT_ICONS) if(s.includes(normalize(k))) return ic;
    return '🍽️';
  }

  let toastTimer;
  function showToast(msg){
    $toast.textContent=msg;$toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>$toast.classList.remove('show'),2200);
  }

  /* ── FAVORITES ── */
  const isFav=id=>favs.includes(String(id));
  function toggleFav(id){
    id=String(id);
    const i=favs.indexOf(id);
    if(i>=0){favs.splice(i,1);showToast('Quitado de favoritos');}
    else{favs.push(id);showToast('❤ Agregado a favoritos');}
    saveFavs();
    document.querySelectorAll(`.fav-btn[data-fav="${id}"]`).forEach(b=>b.classList.toggle('active',isFav(id)));
    if($modalFav.dataset.fav===id){$modalFav.classList.toggle('active',isFav(id));$modalFav.textContent=isFav(id)?'♥':'♡';}
    if(activeFilter==='__favs__') renderCatalog();
  }
  const saveFavs=()=>{try{localStorage.setItem('menu_favs',JSON.stringify(favs));}catch(e){}};
  function loadFavs(){try{const s=JSON.parse(localStorage.getItem('menu_favs')||'[]');if(Array.isArray(s))favs=s.map(String);}catch(e){}}

  /* ── CART LOGIC ── */
  const cartFind=key=>cartItems.find(i=>i.key===key);
  function cartAdd(id,variantes,qty){
    const p=products.find(x=>String(x.id)===String(id));
    if(!p) return;
    const stock=getStockInfo(p),key=cartKey(id,variantes),existing=cartFind(key);
    const newQty=(existing?existing.qty:0)+qty;
    if(newQty>stock.maxQty){showToast('Stock insuficiente');return;}
    if(existing) existing.qty+=qty;
    else cartItems.push({key,id,nombre:p.nombre,precio:getEffectivePrice(p,variantes),qty,variantes:variantes||{},imagen:getImages(p)[0]||''});
    saveCart();updateCartUI();updateCardButtons();showToast('Agregado al pedido');
  }
  function cartRemoveOne(key){
    const item=cartFind(key);if(!item) return;
    item.qty--;if(item.qty<=0) cartItems=cartItems.filter(i=>i.key!==key);
    saveCart();updateCartUI();updateCardButtons();
  }
  function cartDelete(key){cartItems=cartItems.filter(i=>i.key!==key);saveCart();updateCartUI();updateCardButtons();}
  const saveCart=()=>{try{localStorage.setItem('menu_cart',JSON.stringify(cartItems));}catch(e){}};
  function loadCart(){try{const s=JSON.parse(localStorage.getItem('menu_cart')||'[]');if(Array.isArray(s))cartItems=s;}catch(e){}}
  const cartTotalQty=()=>cartItems.reduce((s,i)=>s+i.qty,0);
  const cartTotalPrice=()=>cartItems.reduce((s,i)=>s+i.precio*i.qty,0);

  /* ── CATEGORY STRIP ── */
  function buildCatStrip(){
    const catMap=config.categories||{};
    categorySlugs=Object.keys(catMap);
    let html=`<button class="cat-chip active" data-cat="all"><span class="ic">🔥</span><span class="lb">Todo</span></button>`;
    categorySlugs.forEach(slug=>{
      const name=catMap[slug]||slug;
      html+=`<button class="cat-chip" data-cat="${slug}"><span class="ic">${catIcon(slug,name)}</span><span class="lb">${name}</span></button>`;
    });
    $catStrip.innerHTML=html;
  }
  function setActiveChip(cat){
    $catStrip.querySelectorAll('.cat-chip').forEach(c=>c.classList.toggle('active',c.dataset.cat===cat));
  }

  /* ── CARD TEMPLATE ── */
  function cardHTML(p,i){
    const imgs=getImages(p);
    const inCartQty=cartItems.filter(ci=>String(ci.id)===String(p.id)).reduce((s,ci)=>s+ci.qty,0);
    const hasVariants=Array.isArray(p.variantes)&&p.variantes.length>0;
    const stock=getStockInfo(p);
    const catLabels=config.categories||{};
    const imgHTML=imgs[0]?`<img src="${imgs[0]}" alt="${p.nombre}" loading="lazy"/>`:`<div class="card-img-placeholder">${catIcon((p.categorias||[])[0],p.nombre)}</div>`;
    const badgeHTML=(badgeCat()&&(p.categorias||[]).includes(badgeCat()))?`<span class="card-badge">${catLabels[badgeCat()]||badgeCat()}</span>`:(p.precio_promo?`<span class="card-badge">Oferta</span>`:'');
    const stockBadgeHTML=stock.badge?`<span class="card-stock-badge ${stock.cls}">${stock.badge}</span>`:'';
    const imgCountHTML=imgs.length>1?`<span class="card-img-count"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>${imgs.length}</span>`:'';
    const priceDisplay=typeof p.precio==='number'?formatPrice(p.precio):(p.precio||'');
    return `
      <div class="card" data-id="${p.id}" style="animation-delay:${i*.04}s">
        <div class="card-img" data-open="${p.id}">
          ${imgHTML}${badgeHTML}${stockBadgeHTML}${imgCountHTML}
          <button class="fav-btn${isFav(p.id)?' active':''}" data-fav="${p.id}" aria-label="Favorito">${isFav(p.id)?'♥':'♡'}</button>
        </div>
        <div class="card-body">
          <div class="card-name">${p.nombre}</div>
          ${p.descripcion?`<div class="card-desc">${p.descripcion}</div>`:''}
          <div class="card-foot">
            <div class="card-prices">
              <span class="card-price">${priceDisplay}</span>
              ${p.precio_promo?`<span class="card-promo">${p.precio_promo}</span>`:''}
            </div>
            ${actionHTML(p,inCartQty,hasVariants,stock)}
          </div>
        </div>
      </div>`;
  }
  function actionHTML(p,inCartQty,hasVariants,stock){
    if(!hasVariants&&inCartQty>0){
      return `<div class="qty-control">
          <button data-action="dec" data-id="${p.id}" data-key="${cartKey(p.id,{})}">−</button>
          <span class="qty-val">${inCartQty}</span>
          <button data-action="inc" data-id="${p.id}" ${!stock.canAdd||inCartQty>=stock.maxQty?'disabled':''}>+</button>
        </div>`;
    }
    if(!hasVariants&&!stock.canAdd) return `<button class="btn-add" disabled>Agotado</button>`;
    return `<button class="btn-add icon-only" ${hasVariants?`data-open="${p.id}"`:`data-add="${p.id}"`} aria-label="${hasVariants?'Elegir opciones':'Agregar'}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>`;
  }

  /* ── RENDER CATALOG ── */
  function matchSearch(p){
    return !searchQuery||normalize(p.nombre).includes(searchQuery)||normalize(p.descripcion||'').includes(searchQuery);
  }
  function renderFlat(list,title,em,emptyMsg){
    if(!list.length){$catalog.innerHTML=`<div class="empty-state"><span class="em">${em}</span><p>${emptyMsg}</p></div>`;return;}
    $catalog.innerHTML=`<div class="cat-section"><h2 class="cat-header"><span class="em">${em}</span>${title}</h2><div class="grid">${list.map((p,i)=>cardHTML(p,i)).join('')}</div></div>`;
  }
  function renderCatalog(){
    document.body.classList.remove('location-view');
    if(activeFilter==='__favs__'){
      setActiveChip(null);
      renderFlat(products.filter(p=>isFav(p.id)&&matchSearch(p)),'Tus Favoritos','❤️','No tienes favoritos aún.','Toca el ♡ en cualquier producto para guardarlo.');
      return;
    }
    if(activeFilter==='__offers__'){
      setActiveChip(null);
      renderFlat(products.filter(p=>isOffer(p)&&matchSearch(p)),'Ofertas','🏷️','No hay ofertas activas ahora mismo.');
      return;
    }

    const filtered=products.filter(p=>{
      const matchCat=activeFilter==='all'||(p.categorias||[]).includes(activeFilter);
      return matchCat&&matchSearch(p);
    });
    const groups={};
    filtered.forEach(p=>{const c=(p.categorias||[])[0]||'';(groups[c]=groups[c]||[]).push(p);});

    const catLabels=config.categories||{};
    let html='';
    categorySlugs.forEach(cat=>{
      const inCat=groups[cat]||[];
      if(!inCat.length) return;
      html+=`<div class="cat-section" id="cat-${cat}">
        <h2 class="cat-header"><span class="em">${catIcon(cat,catLabels[cat])}</span>${catLabels[cat]||cat}</h2>
        <div class="grid">${inCat.map((p,i)=>cardHTML(p,i)).join('')}</div>
      </div>`;
    });
    $catalog.innerHTML=html||`<div class="empty-state"><span class="em">🔍</span><p>No se encontraron productos</p></div>`;
    setActiveChip(activeFilter);
    setupIntersectionObserver();
  }

  function renderLocation(){
    document.body.classList.add('location-view');
    if(observer) observer.disconnect();
    $catalog.innerHTML=`
      <section class="location-view-wrap">
        <div class="location-heading">
          <h2>📍 Ubicación y reservas</h2>
          <p>Visítanos o reserva tu mesa en el ambiente que prefieras.</p>
        </div>
        <div class="location-layout">
          <div class="location-card">
            <iframe class="map-frame" title="Ubicación de Casa Res Steak House"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.7993796127007!2d-78.48790582424621!3d-0.17654669982171312!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91d59a859f2bf725%3A0x45e9525e67933d62!2sCasa%20Res%20%7C%20Steak%20House!5e0!3m2!1ses-419!2sec!4v1784835585999!5m2!1ses-419!2sec"
              allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>
          <div class="reservation-card">
            <h3>Reserva tu mesa</h3>
            <p class="reservation-intro">Completa tus datos y envíanos la solicitud por WhatsApp.</p>
            <form class="reservation-form" id="reservationForm">
              <div class="form-field">
                <label for="reservationName">Nombre</label>
                <input id="reservationName" name="name" type="text" autocomplete="given-name" required placeholder="Tu nombre"/>
              </div>
              <div class="form-field">
                <label for="reservationLastName">Apellido</label>
                <input id="reservationLastName" name="lastName" type="text" autocomplete="family-name" required placeholder="Tu apellido"/>
              </div>
              <div class="form-field">
                <label for="reservationPhone">Número de teléfono</label>
                <input id="reservationPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="Ej. 099 123 4567"/>
              </div>
              <div class="form-field">
                <label for="reservationArea">¿En qué parte del restaurante prefieres estar?</label>
                <select id="reservationArea" name="area" required>
                  <option value="" selected disabled>Selecciona una opción</option>
                  <option value="Ventanas">Ventanas</option>
                  <option value="Pérgola">Pérgola</option>
                  <option value="Centro">Centro</option>
                  <option value="Chimenea">Chimenea</option>
                </select>
              </div>
              <button class="btn-reservation" type="submit">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Reservar por WhatsApp
              </button>
            </form>
          </div>
        </div>
      </section>`;
    document.getElementById('reservationForm').addEventListener('submit',sendReservation);
  }

  function sendReservation(e){
    e.preventDefault();
    const num=(config.whatsapp_number||'').replace(/\D/g,'');
    if(!num){showToast('WhatsApp no configurado');return;}
    const form=new FormData(e.currentTarget);
    const store=config.store_name||'el restaurante';
    const msg=`¡Hola! Quiero solicitar una reserva en ${store}.\n\n*DATOS DE LA RESERVA*\n━━━━━━━━━━━━━━━━━\n*Nombre:* ${form.get('name')} ${form.get('lastName')}\n*Teléfono:* ${form.get('phone')}\n*Ubicación preferida:* ${form.get('area')}\n━━━━━━━━━━━━━━━━━\n\nQuedo pendiente de la confirmación. ¡Gracias!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,'_blank');
  }

  function updateCardButtons(){
    document.querySelectorAll('.card').forEach(card=>{
      const id=card.dataset.id,p=products.find(x=>String(x.id)===String(id));
      if(!p) return;
      const inCartQty=cartItems.filter(ci=>String(ci.id)===String(id)).reduce((s,ci)=>s+ci.qty,0);
      const hasVariants=Array.isArray(p.variantes)&&p.variantes.length>0;
      const foot=card.querySelector('.card-foot');if(!foot) return;
      const actionEl=foot.querySelector('.btn-add,.qty-control');
      if(actionEl) actionEl.outerHTML=actionHTML(p,inCartQty,hasVariants,getStockInfo(p));
    });
  }

  /* ── INTERSECTION OBSERVER (sync chip while scrolling in 'all') ── */
  let observer;
  function setupIntersectionObserver(){
    if(observer) observer.disconnect();
    if(activeFilter!=='all'&&activeFilter!=='__none__') return;
    observer=new IntersectionObserver(entries=>{
      entries.forEach(e=>{if(e.isIntersecting) setActiveChip(e.target.id.replace('cat-',''));});
    },{rootMargin:'-25% 0px -65% 0px',threshold:0});
    document.querySelectorAll('.cat-section').forEach(s=>observer.observe(s));
  }

  /* ── PRODUCT MODAL ── */
  function openModal(id){
    const p=products.find(x=>String(x.id)===String(id));if(!p) return;
    modalProduct=p;modalQty=1;modalVariants={};sliderImages=getImages(p);sliderIdx=0;
    $sliderTrack.innerHTML=sliderImages.length
      ?sliderImages.map(src=>`<div class="slider-slide"><img src="${src}" alt="${p.nombre}" loading="lazy"/></div>`).join('')
      :`<div class="slider-slide"><span class="slider-placeholder">${catIcon((p.categorias||[])[0],p.nombre)}</span></div>`;
    $sliderTrack.style.transform='translateX(0)';
    $sliderDots.innerHTML=sliderImages.length>1?sliderImages.map((_,i)=>`<button class="slider-dot${i===0?' active':''}" data-idx="${i}"></button>`).join(''):'';
    $sliderPrev.hidden=$sliderNext.hidden=sliderImages.length<=1;
    $modalFav.dataset.fav=p.id;$modalFav.classList.toggle('active',isFav(p.id));$modalFav.textContent=isFav(p.id)?'♥':'♡';
    renderModalDetail();
    $modalOverlay.classList.add('open');document.body.style.overflow='hidden';
  }
  function renderModalDetail(){
    const p=modalProduct;
    const hasVariants=Array.isArray(p.variantes)&&p.variantes.length>0;
    const stock=getStockInfo(p);
    const allSelected=!hasVariants||p.variantes.every(g=>modalVariants[g.name]);
    const effPrice=allSelected?getEffectivePrice(p,modalVariants):parsePrice(p);
    const canAddModal=stock.canAdd&&allSelected;

    let variantHTML='';
    if(hasVariants){
      variantHTML='<div class="customize-label">Personaliza</div>'+p.variantes.map(g=>`
        <div class="variant-group">
          <div class="variant-glabel">${g.name}</div>
          <div class="variant-options">
            ${g.options.map(opt=>{
              const oKey=getOptionKey(opt),oDisplay=getOptionDisplay(opt),oPrice=getOptionPrice(opt);
              const label=oPrice!==null?`${oDisplay} (${formatPrice(oPrice)})`:oDisplay;
              return `<button class="variant-option${modalVariants[g.name]===oKey?' selected':''}" data-group="${g.name}" data-opt="${oKey}">${label}</button>`;
            }).join('')}
          </div>
        </div>`).join('');
    }

    $modalDetail.innerHTML=`
      <div class="modal-name">${p.nombre}</div>
      <div class="modal-prices">
        <div class="modal-price">${formatPrice(effPrice)}</div>
        ${p.precio_promo?`<div class="modal-promo">${p.precio_promo}</div>`:''}
      </div>
      ${stock.badge?`<div><span class="modal-stock-badge ${stock.cls}">${stock.badge}</span></div>`:''}
      ${p.descripcion?`<div class="modal-desc">${p.descripcion}</div>`:''}
      ${variantHTML}
      ${hasVariants&&!allSelected?'<p class="modal-variant-hint">Selecciona todas las opciones</p>':''}
      ${!stock.canAdd&&allSelected?'<p class="modal-stock-hint">Producto agotado</p>':''}
      <div class="modal-actions">
        <div class="modal-qty">
          <button id="mqDec">−</button>
          <span class="qty-val" id="mqVal">${modalQty}</span>
          <button id="mqInc" ${!stock.canAdd||modalQty>=stock.maxQty?'disabled':''}>+</button>
        </div>
        <button class="btn-modal-add" id="btnModalAdd" ${!canAddModal?'disabled':''}>
          ${stock.canAdd?`Agregar · ${formatPrice(effPrice*modalQty)}`:'Agotado'}
        </button>
      </div>`;

    document.getElementById('mqDec').addEventListener('click',()=>{if(modalQty>1){modalQty--;renderModalDetail();}});
    document.getElementById('mqInc').addEventListener('click',()=>{
      if(modalQty>=stock.maxQty){showToast('Stock insuficiente');return;}
      modalQty++;renderModalDetail();
    });
    document.getElementById('btnModalAdd').addEventListener('click',()=>{cartAdd(modalProduct.id,modalVariants,modalQty);closeModal();});
    $modalDetail.querySelectorAll('.variant-option').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const {group,opt}=btn.dataset;
        if(modalVariants[group]===opt) delete modalVariants[group];
        else modalVariants[group]=opt;
        renderModalDetail();
      });
    });
  }
  function closeModal(){$modalOverlay.classList.remove('open');document.body.style.overflow='';modalProduct=null;}

  /* ── SLIDER ── */
  function slideTo(idx){
    if(sliderImages.length<=1) return;
    sliderIdx=Math.max(0,Math.min(idx,sliderImages.length-1));
    $sliderTrack.style.transform=`translateX(-${sliderIdx*100}%)`;
    $sliderDots.querySelectorAll('.slider-dot').forEach((d,i)=>d.classList.toggle('active',i===sliderIdx));
  }
  $sliderPrev.addEventListener('click',e=>{e.stopPropagation();slideTo(sliderIdx-1);});
  $sliderNext.addEventListener('click',e=>{e.stopPropagation();slideTo(sliderIdx+1);});
  $sliderDots.addEventListener('click',e=>{const d=e.target.closest('.slider-dot');if(d) slideTo(Number(d.dataset.idx));});
  let touchStartX=0;
  const $sw=document.getElementById('sliderWrap');
  $sw.addEventListener('touchstart',e=>{touchStartX=e.changedTouches[0].clientX;},{passive:true});
  $sw.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchStartX;if(Math.abs(dx)>40) slideTo(dx<0?sliderIdx+1:sliderIdx-1);});

  /* ── CART UI ── */
  function updateCartUI(){
    const qty=cartTotalQty(),total=cartTotalPrice();
    $navBadge.textContent=qty;$navBadge.classList.toggle('show',qty>0);
    $peekCount.textContent=qty;$peekTotal.textContent=formatPrice(total);
    const sheetOpen=$cartDrawer.classList.contains('open');
    $cartPeek.classList.toggle('show',qty>0&&!sheetOpen);
    $cartTotal.textContent=formatPrice(total);
    $cartItemCount.textContent=`${qty} item(s) · ${cartItems.length} producto(s)`;
    $btnCheckout.disabled=qty===0;

    if(!cartItems.length){
      $cartItems.innerHTML=`<div class="cart-empty"><span class="em">🛒</span><p>Tu pedido está vacío</p></div>`;
      return;
    }
    $cartItems.innerHTML=cartItems.map(item=>{
      const vLabel=variantLabel(item.variantes);
      return `<div class="cart-item">
        ${item.imagen?`<img src="${item.imagen}" alt="${item.nombre}" loading="lazy"/>`:`<div class="ph">🍽️</div>`}
        <div class="cart-item-info">
          <div class="cart-item-name">${item.nombre}</div>
          ${vLabel?`<div class="cart-item-variant">${vLabel}</div>`:''}
          <div class="cart-item-detail">${item.qty} × ${formatPrice(item.precio)} = ${formatPrice(item.precio*item.qty)}</div>
        </div>
        <button class="cart-item-remove" data-key="${item.key}" title="Quitar">✕</button>
      </div>`;
    }).join('');
  }
  function openCart(){$cartOverlay.classList.add('open');$cartDrawer.classList.add('open');document.body.style.overflow='hidden';setActiveNav('cart');$cartPeek.classList.remove('show');}
  function closeCart(){$cartOverlay.classList.remove('open');$cartDrawer.classList.remove('open');document.body.style.overflow='';syncNavToFilter();updateCartUI();goToStep1();}

  /* ── CHECKOUT STEPS ── */
  function goToStep1(){
    $cartItems.style.display='';
    document.querySelector('.cart-footer').style.display='';
    document.getElementById('cartStep2').style.display='none';
    document.getElementById('cartTitle').textContent='Tu Pedido';
    document.getElementById('cartBack').style.display='none';
  }
  function goToStep2(){
    if(!cartItems.length) return;
    $cartItems.style.display='none';
    document.querySelector('.cart-footer').style.display='none';
    document.getElementById('cartStep2').style.display='flex';
    document.getElementById('cartTitle').textContent='Datos de entrega';
    document.getElementById('cartBack').style.display='';
  }

  /* ── WHATSAPP CHECKOUT ── */
  function checkout(){
    const num=(config.whatsapp_number||'').replace(/\D/g,'');
    if(!num){showToast('WhatsApp no configurado');return;}
    const name=document.getElementById('fieldName').value.trim();
    const phone=document.getElementById('fieldPhone').value.trim();
    const mode=document.querySelector('.dtog-btn.active')?.dataset.mode||'delivery';
    const address=mode==='delivery'?document.getElementById('fieldAddress').value.trim():'';
    if(!name||!phone){showToast('Completa tu nombre y teléfono');return;}
    if(mode==='delivery'&&!address){showToast('Ingresa tu dirección de entrega');return;}
    const total=cartTotalPrice(),cur=config.currency||'$',store=config.store_name||'Catálogo';

    // Notifica al dueño antes de abrir WA — fire-and-forget
    if(config.catalog_notify_url&&config.catalog_notify_token){
      fetch(config.catalog_notify_url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          token:config.catalog_notify_token,
          store_name:store,
          items:cartItems.map(i=>({nombre:i.nombre,qty:i.qty,precio:i.precio,variant:variantLabel(i.variantes)||undefined})),
          total,currency:cur,
          client_name:name,client_phone:phone,
          delivery_mode:mode,address:address||undefined,
          store_url:location.href
        })
      }).catch(()=>{});
    }

    let msg=`${config.whatsapp_message||'¡Hola! Quiero hacer un pedido:'}\n\n*PEDIDO — ${store}*\n━━━━━━━━━━━━━━━━━\n`;
    cartItems.forEach(item=>{
      const vLabel=variantLabel(item.variantes);
      msg+=`▸ ${item.nombre}${vLabel?' ('+vLabel+')':''}\n  ${item.qty} × ${formatPrice(item.precio)} = ${formatPrice(item.precio*item.qty)}\n`;
    });
    msg+=`━━━━━━━━━━━━━━━━━\n*TOTAL: ${cur}${total.toFixed(2)}*\n\n`;
    msg+=`*ENTREGA:* ${mode==='delivery'?'Domicilio':'Retiro en local'}\n`;
    msg+=`*Cliente:* ${name}\n*Teléfono:* ${phone}\n`;
    if(address) msg+=`*Dirección:* ${address}\n`;
    msg+=`\n${location.href}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`,'_blank');
  }

  /* ── BOTTOM NAV ── */
  function setActiveNav(name){document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.nav===name));}
  function syncNavToFilter(){
    setActiveNav(activeFilter==='__offers__'?'offers':activeFilter==='__location__'?'location':'home');
  }
  function goTop(){window.scrollTo({top:0,behavior:'smooth'});}
  document.querySelector('.bottom-nav').addEventListener('click',e=>{
    const item=e.target.closest('.nav-item');if(!item) return;
    const nav=item.dataset.nav;
    if(nav==='cart'){openCart();return;}
    searchQuery='';$searchInput.value='';
    activeFilter=nav==='offers'?'__offers__':nav==='location'?'__location__':'all';
    setActiveNav(nav);
    if(nav==='location') renderLocation(); else renderCatalog();
    goTop();
  });
  $cartPeek.addEventListener('click',openCart);

  /* ── EVENT DELEGATION ── */
  document.addEventListener('click',e=>{
    const favBtn=e.target.closest('[data-fav]');
    if(favBtn){e.stopPropagation();toggleFav(favBtn.dataset.fav);return;}

    const addTrigger=e.target.closest('[data-add]');
    if(addTrigger&&!e.target.closest('[data-action]')){
      const p=products.find(x=>String(x.id)===String(addTrigger.dataset.add));
      if(p&&getStockInfo(p).canAdd) cartAdd(addTrigger.dataset.add,{},1);
      return;
    }
    const openTrigger=e.target.closest('[data-open]');
    if(openTrigger&&!e.target.closest('[data-action]')){openModal(openTrigger.dataset.open);return;}

    const btn=e.target.closest('[data-action]');
    if(btn){
      const {action,id,key}=btn.dataset;
      if(action==='inc'){const p=products.find(x=>String(x.id)===String(id));if(p&&getStockInfo(p).canAdd) cartAdd(id,{},1);}
      if(action==='dec'&&key) cartRemoveOne(key);
      return;
    }
    const removeBtn=e.target.closest('.cart-item-remove');
    if(removeBtn){cartDelete(removeBtn.dataset.key);return;}
  });

  $catStrip.addEventListener('click',e=>{
    const chip=e.target.closest('.cat-chip');if(!chip) return;
    const cat=chip.dataset.cat;
    searchQuery='';$searchInput.value='';
    activeFilter=cat;setActiveNav('home');renderCatalog();
    if(cat!=='all') requestAnimationFrame(()=>{const s=document.getElementById('cat-'+cat);if(s) s.scrollIntoView({behavior:'smooth'});});
    else goTop();
  });

  $searchInput.addEventListener('input',()=>{
    searchQuery=normalize($searchInput.value);
    if(activeFilter==='__offers__'||activeFilter==='__favs__'){renderCatalog();return;}
    activeFilter='all';setActiveNav('home');renderCatalog();
  });

  $cartOverlay.addEventListener('click',closeCart);
  $cartClose.addEventListener('click',closeCart);
  $btnCheckout.addEventListener('click',goToStep2);
  document.getElementById('cartBack').addEventListener('click',goToStep1);
  document.getElementById('btnConfirm').addEventListener('click',checkout);
  document.getElementById('deliveryToggle').addEventListener('click',e=>{
    const btn=e.target.closest('.dtog-btn');if(!btn) return;
    document.querySelectorAll('.dtog-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('fieldAddressWrap').style.display=btn.dataset.mode==='delivery'?'':'none';
  });
  $modalOverlay.addEventListener('click',e=>{if(e.target===$modalOverlay) closeModal();});
  $modalClose.addEventListener('click',closeModal);
  $modalFav.addEventListener('click',()=>toggleFav($modalFav.dataset.fav));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeModal();closeCart();}
    if($modalOverlay.classList.contains('open')){
      if(e.key==='ArrowLeft') slideTo(sliderIdx-1);
      if(e.key==='ArrowRight') slideTo(sliderIdx+1);
    }
  });

  /* ── INIT ── */
  async function init(){
    try{const r=await fetch('config.json',{cache:'no-store'});if(r.ok) config=await r.json();}catch(e){}

    const root=document.documentElement.style;
    if(config.theme_primary) root.setProperty('--primary',config.theme_primary);
    if(config.theme_accent) root.setProperty('--accent',config.theme_accent);

    const store=config.store_name||'Catálogo';
    document.getElementById('brandName').textContent=store;
    document.getElementById('footerLink').textContent=store;
    document.getElementById('footerYear').textContent=new Date().getFullYear();
    document.title=config.site_title||store;
    if(config.hero_title) document.getElementById('heroTitle').innerHTML=config.hero_title;

    const mu=config.min_units,md=config.min_days_advance;
    if(mu||md){
      const parts=[];
      if(mu) parts.push(`Mín. <strong>${mu} unidades</strong>`);
      if(md) parts.push(`con <strong>${md} días</strong> de anticipación`);
      const $n=document.getElementById('heroNotice');
      $n.innerHTML=parts.join(', ')+'.';$n.style.display='inline-block';
    }

    const res=await fetch('productos.json',{cache:'no-store'});
    products=await res.json();

    buildCatStrip();
    loadCart();loadFavs();
    cartItems=cartItems.filter(ci=>products.find(p=>String(p.id)===String(ci.id)));

    renderCatalog();updateCartUI();

    const preOpen=new URLSearchParams(location.search).get('producto');
    if(preOpen){const p=products.find(x=>x.slug===preOpen||String(x.id)===preOpen);if(p) openModal(p.id);}
  }

  init().catch(err=>{
    console.error(err);
    $catalog.innerHTML='<div class="empty-state"><span class="em">⚠️</span><p>Error cargando catálogo</p></div>';
  });
})();
