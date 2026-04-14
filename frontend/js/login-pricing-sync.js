document.addEventListener('DOMContentLoaded', function () {
  const pricingData = window.RoleRocketPricingData;
  if (!pricingData) {
    return;
  }

  document.querySelectorAll('[data-login-plan], [data-pricing-plan]').forEach((card) => {
    const planKey = card.getAttribute('data-login-plan') || card.getAttribute('data-pricing-plan');
    const list = card.querySelector('[data-login-plan-features], [data-pricing-plan-features]');
    const planData = pricingData.candidatePlans[planKey] || pricingData.recruiterPlans[planKey];

    if (!list || !planData) {
      return;
    }

    list.innerHTML = planData.features.map((feature) => `<li>${feature}</li>`).join('');
  });
});