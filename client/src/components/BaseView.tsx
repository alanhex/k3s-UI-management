import React from 'react';

const BaseView: React.FC<{ title: string }> = ({ title }) => {
    return (
        <div>
            <h2>{title}</h2>
            <p>Resource visualization will be implemented here.</p>
        </div>
    );
};

export default BaseView;