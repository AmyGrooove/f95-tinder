const SERVICE_HEALTH_HTML = `<li class="service {{statusClass}}">
          <span class="service-label">
            <svg class="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{{icon}}</svg>
            <span class="service-name">{{serviceName}}</span>
          </span>
          <span class="service-status"><span class="status-dot" aria-hidden="true"></span>{{status}}</span>
        </li>`

export { SERVICE_HEALTH_HTML }
