(function() {
  try {
    // 1. Immediate Theme Application
    var theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    
    // 2. Visibility Activation
    function markReady() {
      if (document.body) document.body.classList.add('is-ready');
    }
    
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      markReady();
    } else {
      window.addEventListener('DOMContentLoaded', markReady);
    }
    
    // 3. Fail-safe timeout (max 500ms hide)
    setTimeout(markReady, 500);
  } catch (e) {
    if (document.body) document.body.style.opacity = '1';
  }
})();
